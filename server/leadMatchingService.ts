import type { Pool } from 'pg';
import { emailService } from './emailService';

interface MatchResult {
  leadId: number;
  score: number;
  reasons: {
    budget: boolean;
    bedrooms: boolean;
    area: boolean;
    propertyType: boolean;
  };
}

/**
 * Find leads matching a property based on budget, bedrooms, area, and property type.
 * Scoring: budget (+40), bedrooms (+25), area (+25), propertyType (+10).
 * Only returns leads with score >= 50.
 */
export async function findMatchingLeads(propertyId: number, pool: Pool): Promise<MatchResult[]> {
  // Get the property details
  const propResult = await pool.query(
    `SELECT id, price, rent_amount, bedrooms, postcode, property_type, is_rental
     FROM property WHERE id = $1`,
    [propertyId]
  );

  if (propResult.rows.length === 0) {
    return [];
  }

  const property = propResult.rows[0];
  const isRental = property.is_rental;
  const propertyPrice = isRental ? property.rent_amount : property.price; // both in pence

  // Find active leads of the right type
  const leadTypeFilter = isRental
    ? `l.lead_type IN ('rental', 'both')`
    : `l.lead_type IN ('purchase', 'both')`;

  const leadsResult = await pool.query(
    `SELECT l.id, l.min_budget, l.max_budget, l.preferred_bedrooms,
            l.preferred_areas, l.preferred_property_type
     FROM lead l
     WHERE ${leadTypeFilter}
       AND l.status NOT IN ('converted', 'lost')
       AND NOT EXISTS (
         SELECT 1 FROM lead_property_match lpm
         WHERE lpm.lead_id = l.id AND lpm.property_id = $1
       )`,
    [propertyId]
  );

  const matches: MatchResult[] = [];

  for (const lead of leadsResult.rows) {
    let score = 0;
    const reasons = {
      budget: false,
      bedrooms: false,
      area: false,
      propertyType: false,
    };

    // Budget match (+40): property price falls within lead's min_budget..max_budget
    if (propertyPrice != null && (lead.min_budget != null || lead.max_budget != null)) {
      const min = lead.min_budget ?? 0;
      const max = lead.max_budget ?? Number.MAX_SAFE_INTEGER;
      if (propertyPrice >= min && propertyPrice <= max) {
        score += 40;
        reasons.budget = true;
      }
    }

    // Bedrooms match (+25): exact match
    if (lead.preferred_bedrooms != null && property.bedrooms != null) {
      if (lead.preferred_bedrooms === property.bedrooms) {
        score += 25;
        reasons.bedrooms = true;
      }
    }

    // Area match (+25): property postcode starts with any of lead's preferred_areas (case-insensitive prefix)
    if (lead.preferred_areas && Array.isArray(lead.preferred_areas) && lead.preferred_areas.length > 0 && property.postcode) {
      const postcode = property.postcode.toUpperCase();
      const areaMatch = lead.preferred_areas.some((area: string) =>
        postcode.startsWith(area.toUpperCase())
      );
      if (areaMatch) {
        score += 25;
        reasons.area = true;
      }
    }

    // Property type match (+10): exact match
    if (lead.preferred_property_type && property.property_type) {
      if (lead.preferred_property_type.toLowerCase() === property.property_type.toLowerCase()) {
        score += 10;
        reasons.propertyType = true;
      }
    }

    if (score >= 50) {
      matches.push({ leadId: lead.id, score, reasons });
    }
  }

  return matches;
}

/**
 * Create match records for a property. Calls findMatchingLeads and inserts pending matches.
 * Returns count of matches created.
 */
export async function createMatchesForProperty(propertyId: number, pool: Pool): Promise<number> {
  const matches = await findMatchingLeads(propertyId, pool);

  if (matches.length === 0) {
    return 0;
  }

  let created = 0;
  for (const match of matches) {
    await pool.query(
      `INSERT INTO lead_property_match (lead_id, property_id, match_score, match_reasons, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'pending', NOW(), NOW())`,
      [match.leadId, propertyId, match.score, JSON.stringify(match.reasons)]
    );
    created++;
  }

  return created;
}

/**
 * Approve a match: sets status to 'approved', sends property details email to the lead,
 * then sets status to 'sent'.
 */
export async function approveMatch(matchId: number, userId: number, pool: Pool): Promise<void> {
  // Update match to approved
  await pool.query(
    `UPDATE lead_property_match SET status = 'approved', approved_by = $2, approved_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [matchId, userId]
  );

  // Get match details with lead and property info
  const result = await pool.query(
    `SELECT lpm.id, lpm.lead_id, lpm.property_id,
            l.full_name as lead_name, l.email as lead_email,
            p.title as property_title, p.address, p.address_line1, p.postcode,
            p.price, p.rent_amount, p.bedrooms, p.images, p.is_rental
     FROM lead_property_match lpm
     JOIN lead l ON lpm.lead_id = l.id
     JOIN property p ON lpm.property_id = p.id
     WHERE lpm.id = $1`,
    [matchId]
  );

  if (result.rows.length === 0) {
    return;
  }

  const match = result.rows[0];

  if (!match.lead_email) {
    // No email to send to, just leave as approved
    return;
  }

  // Format price
  const priceValue = match.is_rental ? match.rent_amount : match.price;
  const priceFormatted = priceValue != null
    ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(priceValue / 100)
    : 'Price on application';
  const priceLabel = match.is_rental ? `${priceFormatted} pcm` : priceFormatted;

  const propertyAddress = match.address || match.address_line1 || '';
  const propertyTitle = match.property_title || propertyAddress;
  const appUrl = process.env.APP_URL || 'https://johnbarclay.co.uk';
  const viewLink = `${appUrl}/property/${match.property_id}`;

  // Get first image if available
  let imageUrl = '';
  if (match.images && Array.isArray(match.images) && match.images.length > 0) {
    imageUrl = match.images[0];
  }

  const subject = `New Property Match: ${propertyTitle}`;
  const html = `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fff;">
      <div style="background: #791E75; padding: 20px; text-align: center;">
        <h1 style="color: #F8B324; margin: 0; font-size: 24px;">John Barclay</h1>
        <p style="color: #fff; margin: 5px 0 0 0; font-size: 14px;">Property Match</p>
      </div>
      <div style="padding: 24px;">
        <p style="color: #333;">Dear ${match.lead_name},</p>
        <p style="color: #333;">We have found a new property that matches your requirements:</p>
        ${imageUrl ? `<img src="${imageUrl}" alt="${propertyTitle}" style="width: 100%; max-height: 300px; object-fit: cover; border-radius: 8px; margin: 16px 0;" />` : ''}
        <h2 style="color: #791E75; margin: 16px 0 8px 0;">${propertyTitle}</h2>
        <p style="color: #666; margin: 0 0 8px 0;">${propertyAddress}${match.postcode ? `, ${match.postcode}` : ''}</p>
        <p style="font-size: 22px; color: #791E75; font-weight: bold; margin: 8px 0;">${priceLabel}</p>
        ${match.bedrooms != null ? `<p style="color: #666;">${match.bedrooms} bedroom${match.bedrooms !== 1 ? 's' : ''}</p>` : ''}
        <div style="text-align: center; margin: 24px 0;">
          <a href="${viewLink}" style="background: #791E75; color: #fff; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">View Property</a>
        </div>
        <p style="color: #999; font-size: 12px; margin-top: 24px;">
          This email was sent by John Barclay Estate Agents because your property preferences matched this listing.
          If you no longer wish to receive these notifications, please contact us.
        </p>
      </div>
    </div>
  `;

  try {
    await emailService.sendEmail(match.lead_email, subject, html);

    // Update match to sent
    await pool.query(
      `UPDATE lead_property_match SET status = 'sent', sent_at = NOW(), sent_via = 'email', updated_at = NOW()
       WHERE id = $1`,
      [matchId]
    );
  } catch (err) {
    console.error(`Failed to send match email for match ${matchId}:`, err);
    // Leave status as 'approved' if email fails
  }
}

/**
 * Dismiss a match (staff decided not to send).
 */
export async function dismissMatch(matchId: number, pool: Pool): Promise<void> {
  await pool.query(
    `UPDATE lead_property_match SET status = 'dismissed', updated_at = NOW() WHERE id = $1`,
    [matchId]
  );
}
