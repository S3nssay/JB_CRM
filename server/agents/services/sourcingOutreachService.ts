/**
 * Sourcing Outreach Service
 *
 * AI-powered outreach drafting for Charlie (Property Sourcing Agent).
 * Generates source-specific outreach messages using OpenAI, creates branded
 * letter PDFs for post channel, and sends approved emails.
 *
 * CRITICAL: draftOutreach NEVER sends emails directly. All outreach is created
 * with approvalStatus='pending' and only sent via sendApprovedEmail after staff approval.
 */

export interface OutreachDraftResult {
  contactHistoryId: number;
  channel: 'email' | 'post';
  subject: string;
  content: string;
  pdfBuffer?: Buffer;
}

// ============================================================
// Source-specific prompt builders
// ============================================================

function buildSourcePrompt(lead: any): string {
  const { lead_source, property_address, postcode, owner_name, days_on_market,
    original_agent, auction_result, auction_house, ownership_duration, metadata } = lead;

  const name = owner_name || 'Property Owner';
  const baseContext = `Property: ${property_address}, ${postcode}. Recipient: ${name}.`;

  switch (lead_source) {
    case 'expired_listing':
      return `${baseContext}
This property was previously listed with ${original_agent || 'another agent'} for ${days_on_market || 'several'} days but did not sell.
Write a professional letter explaining that we have active buyers looking in ${postcode} and can offer a fresh marketing approach.
Emphasise our local expertise in W9, W10, W11, NW6, NW8 areas. Mention complimentary valuation.`;

    case 'auction': {
      const result = auction_result || 'unsold';
      if (result === 'unsold' || result === 'withdrawn') {
        return `${baseContext}
This property was offered at auction by ${auction_house || 'an auction house'} but was ${result}.
Write a professional letter offering a quick private sale as a discreet alternative to auction.
Emphasise our ability to find serious buyers without the uncertainty of the auction process.`;
      }
      return `${baseContext}
This property was sold at auction. Write a brief, congratulatory note offering our management services if they are considering letting the property.`;
    }

    case 'land_registry': {
      const durationDays = ownership_duration || 0;
      const isProbate = metadata?.is_probate === true || metadata?.title_flags?.includes('probate');
      const isRecent = durationDays < 730; // < 2 years
      const isLongTerm = durationDays > 5475; // > 15 years

      if (isProbate) {
        return `${baseContext}
This property may be part of a probate or estate matter. We understand this may be a difficult time.
Write an extremely sensitive and respectful letter. Do NOT be pushy or salesy.
Offer gentle support: "Should you ever wish to discuss the property, we are here to help."
Mention our experience handling property matters during difficult times with discretion and care.`;
      }
      if (isRecent) {
        return `${baseContext}
The owner purchased this property recently. Write a warm, welcoming letter.
Welcome them to the area and mention we are new to the area neighbours who know ${postcode} well.
Offer a complimentary, no-obligation valuation and local area guide. Keep it friendly, not salesy.`;
      }
      if (isLongTerm) {
        return `${baseContext}
The owner has held this property for over 15 years. Properties like theirs are in high demand in ${postcode}.
Write a letter mentioning that properties like yours are in high demand and values have risen significantly.
Offer a free market appraisal to show them what their property could achieve today.`;
      }
      return `${baseContext}
Write a professional introduction letter offering our estate agency services for this property in ${postcode}.
Mention our local expertise and offer a complimentary valuation.`;
    }

    case 'planning_permission':
      return `${baseContext}
We noticed planning permission has been granted or applied for at this property.
Write a letter mentioning that if you're considering selling after the development, we can help maximise the value.
If they are considering selling the property as-is with planning permission, we have buyers interested in development opportunities.`;

    case 'competitor_listing':
      return `${baseContext}
This property is currently listed with another agent (${original_agent || 'a competitor'}) and has been on the market for ${days_on_market || 'some'} days.
Write a professional letter offering a fresh approach and premium marketing strategy.
Mention our track record in ${postcode} and our premium marketing including professional photography, video tours, and targeted buyer matching.
Do NOT criticise the other agent -- focus on what we offer differently.`;

    default:
      return `${baseContext}
Write a professional introduction letter from John Barclay Estate Agents offering our services for this property in ${postcode}.
Mention our local expertise and offer a complimentary valuation.`;
  }
}

// ============================================================
// Draft Outreach
// ============================================================

/**
 * Draft an AI-generated outreach message for a proactive lead.
 * Creates a lead_contact_history record with status='draft' and approvalStatus='pending'.
 * NEVER sends email directly -- only creates drafts for staff approval.
 */
export async function draftOutreach(
  leadId: number,
  sequenceStep: number = 0
): Promise<OutreachDraftResult> {
  const { pool } = await import('../../server/db');
  const { getOpenAIClient } = await import('../../server/lib/openaiClient');
  const { generateOutreachLetterPDF } = await import('../../server/services/pdfService');

  // 1. Get the lead
  const leadResult = await pool.query(
    'SELECT * FROM proactive_lead WHERE id = $1',
    [leadId]
  );
  if (leadResult.rows.length === 0) {
    throw new Error(`Proactive lead ${leadId} not found`);
  }
  const lead = leadResult.rows[0];

  // 2. Determine channel from sequence
  let channel: 'email' | 'post' = 'post';

  // Check campaign config for custom sequence
  if (lead.campaign_id) {
    const configResult = await pool.query(
      `SELECT config FROM lead_monitoring_config WHERE id = $1`,
      [lead.campaign_id]
    );
    if (configResult.rows.length > 0) {
      const config = configResult.rows[0].config;
      if (config?.followUpSequence?.[sequenceStep]) {
        channel = config.followUpSequence[sequenceStep].channel;
      }
    }
  }

  // Default sequence: step 0 = post, step 1 = email, step 2 = post
  if (!lead.campaign_id || channel === 'post') {
    const DEFAULT_CHANNELS: Record<number, 'email' | 'post'> = { 0: 'post', 1: 'email', 2: 'post' };
    channel = DEFAULT_CHANNELS[sequenceStep] ?? 'post';
  }

  // 3. Build source-specific prompt and call OpenAI
  const sourcePrompt = buildSourcePrompt(lead);
  const openai = getOpenAIClient();

  const isLetter = channel === 'post';
  const formatInstruction = isLetter
    ? 'Format as a formal letter body (no addresses or date -- those are added separately). Start with "Dear {name},".'
    : 'Format as a professional email body. Start with "Dear {name},". Include a clear subject line on the first line prefixed with "Subject: ".';

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a copywriter for John Barclay Estate Agents, a premium estate agency covering W9, W10, W11, NW6, NW8 in London.
Write in professional British English. Be warm but never pushy. Sign off as John Barclay Estate Agents.
${formatInstruction}`
      },
      {
        role: 'user',
        content: sourcePrompt
      }
    ],
    temperature: 0.7,
    max_tokens: 800
  });

  const aiContent = completion.choices[0]?.message?.content || '';

  // Extract subject for email
  let subject = `Property Opportunity - ${lead.property_address}`;
  let content = aiContent;
  if (channel === 'email') {
    const subjectMatch = aiContent.match(/^Subject:\s*(.+)/im);
    if (subjectMatch) {
      subject = subjectMatch[1].trim();
      content = aiContent.replace(/^Subject:\s*.+\n?/im, '').trim();
    }
  }

  // 4. Generate PDF for letter channel
  let pdfBuffer: Buffer | undefined;
  let pdfUrl: string | null = null;

  if (isLetter) {
    const letterData = {
      recipientName: lead.owner_name || 'Property Owner',
      recipientAddress: lead.owner_address || lead.property_address,
      propertyAddress: lead.property_address,
      leadSource: lead.lead_source,
      personalizedMessage: content,
      date: new Date()
    };
    pdfBuffer = await generateOutreachLetterPDF(letterData);

    // Store PDF in uploads/sourcing/
    const fs = await import('fs');
    const path = await import('path');
    const dir = path.resolve('uploads/sourcing');
    await fs.promises.mkdir(dir, { recursive: true });
    const filename = `outreach-${leadId}-step${sequenceStep}-${Date.now()}.pdf`;
    const filepath = path.join(dir, filename);
    await fs.promises.writeFile(filepath, pdfBuffer);
    pdfUrl = `/uploads/sourcing/${filename}`;
  }

  // 5. Insert lead_contact_history with status='draft', approvalStatus='pending'
  const insertResult = await pool.query(
    `INSERT INTO lead_contact_history
      (lead_id, contact_method, contact_direction, subject, content, status,
       approval_status, pdf_url, sequence_step, created_at)
     VALUES ($1, $2, 'outbound', $3, $4, 'draft', 'pending', $5, $6, NOW())
     RETURNING id`,
    [leadId, channel === 'post' ? 'post' : 'email', subject, content, pdfUrl, sequenceStep]
  );
  const contactHistoryId = insertResult.rows[0].id;

  // 6. Update lead status if currently new or researching
  if (lead.status === 'new' || lead.status === 'researching') {
    await pool.query(
      `UPDATE proactive_lead SET status = 'ready_to_contact', updated_at = NOW() WHERE id = $1`,
      [leadId]
    );
  }

  return { contactHistoryId, channel, subject, content, pdfBuffer };
}

// ============================================================
// Send Approved Email
// ============================================================

/**
 * Send an approved email outreach. Only called after staff approval.
 */
export async function sendApprovedEmail(contactHistoryId: number): Promise<void> {
  const { pool } = await import('../../server/db');
  const { emailService } = await import('../../server/emailService');

  // Get contact history + lead details
  const result = await pool.query(
    `SELECT lch.*, pl.owner_email, pl.owner_name, pl.property_address, pl.id as proactive_lead_id
     FROM lead_contact_history lch
     JOIN proactive_lead pl ON pl.id = lch.lead_id
     WHERE lch.id = $1`,
    [contactHistoryId]
  );
  if (result.rows.length === 0) {
    throw new Error(`Contact history ${contactHistoryId} not found`);
  }
  const record = result.rows[0];

  if (!record.owner_email) {
    throw new Error(`No email address for lead ${record.lead_id}`);
  }

  // Format content as HTML
  const htmlContent = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: #791E75; color: white; padding: 20px; text-align: center;">
      <h2 style="margin: 0;">John Barclay Estate & Management</h2>
    </div>
    <div style="padding: 20px;">
      ${record.content.split('\n').map((p: string) => `<p>${p}</p>`).join('')}
    </div>
    <div style="border-top: 1px solid #791E75; padding: 10px; font-size: 12px; color: #888;">
      John Barclay Estate & Management | 020 7262 4400 | info@johnbarclay.co.uk
    </div>
  </div>`;

  // Send email
  await emailService.sendEmail(record.owner_email, record.subject, htmlContent);

  // Update contact history: status='sent', sentAt=NOW()
  await pool.query(
    `UPDATE lead_contact_history SET status = 'sent', sent_at = NOW() WHERE id = $1`,
    [contactHistoryId]
  );

  // Update proactive_lead: status='contacted', increment contact_attempts
  await pool.query(
    `UPDATE proactive_lead
     SET status = 'contacted',
         contact_attempts = COALESCE(contact_attempts, 0) + 1,
         last_contact_date = NOW(),
         last_contact_method = 'email',
         updated_at = NOW()
     WHERE id = $1`,
    [record.proactive_lead_id]
  );

  // Calculate next follow-up date
  const { calculateNextFollowUpDate, getFollowUpSequence } = await import('./sourcingFollowUpService');
  const sequence = getFollowUpSequence();
  const nextDate = calculateNextFollowUpDate(record.sequence_step || 0, sequence);
  if (nextDate) {
    await pool.query(
      `UPDATE proactive_lead SET next_follow_up_date = $1 WHERE id = $2`,
      [nextDate, record.proactive_lead_id]
    );
  }
}

// ============================================================
// Send Approved Letter (mark as sent -- staff prints & posts)
// ============================================================

/**
 * Mark an approved letter outreach as sent. Staff downloads the PDF and posts it manually.
 */
export async function sendApprovedLetter(contactHistoryId: number): Promise<void> {
  const { pool } = await import('../../server/db');

  // Update contact history: status='sent', sentAt=NOW()
  await pool.query(
    `UPDATE lead_contact_history SET status = 'sent', sent_at = NOW() WHERE id = $1`,
    [contactHistoryId]
  );

  // Get lead ID from contact history
  const result = await pool.query(
    `SELECT lead_id, sequence_step FROM lead_contact_history WHERE id = $1`,
    [contactHistoryId]
  );
  if (result.rows.length === 0) return;
  const { lead_id, sequence_step } = result.rows[0];

  // Update proactive_lead: status='contacted', increment contact_attempts
  await pool.query(
    `UPDATE proactive_lead
     SET status = 'contacted',
         contact_attempts = COALESCE(contact_attempts, 0) + 1,
         last_contact_date = NOW(),
         last_contact_method = 'post',
         updated_at = NOW()
     WHERE id = $1`,
    [lead_id]
  );

  // Calculate next follow-up date
  const { calculateNextFollowUpDate, getFollowUpSequence } = await import('./sourcingFollowUpService');
  const sequence = getFollowUpSequence();
  const nextDate = calculateNextFollowUpDate(sequence_step || 0, sequence);
  if (nextDate) {
    await pool.query(
      `UPDATE proactive_lead SET next_follow_up_date = $1 WHERE id = $2`,
      [nextDate, lead_id]
    );
  }
}
