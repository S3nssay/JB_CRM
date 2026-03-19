/**
 * Contact Identity Resolver
 * Resolves phone/email identifiers to CRM contacts across tenant, landlord, and lead tables.
 * Creates new contact_identity rows for unknown senders.
 */

import { eq, and, or } from 'drizzle-orm';
import { db, pool } from '../../db';
import { contactIdentities } from '@shared/schema';
import type { CommunicationChannel } from '../types';
import type { ResolvedContact } from './types';

/**
 * Normalise a phone number to E.164 format.
 * Handles UK numbers: 07xxx -> +447xxx, 0044 -> +44
 */
export function normalizePhone(phone: string): string {
  // Strip spaces, dashes, parentheses
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');

  // Convert 0044 prefix to +44
  if (cleaned.startsWith('0044')) {
    cleaned = '+44' + cleaned.slice(4);
  }

  // Convert UK mobile 07/01/02 to +44
  if (cleaned.startsWith('0') && !cleaned.startsWith('+')) {
    cleaned = '+44' + cleaned.slice(1);
  }

  // Ensure starts with +
  if (!cleaned.startsWith('+')) {
    // Assume UK if no country code
    cleaned = '+44' + cleaned;
  }

  return cleaned;
}

/**
 * Normalise an identifier based on channel type.
 * Phone channels use E.164; email channels use lowercase.
 */
export function normalizeIdentifier(identifier: string, channel: CommunicationChannel): string {
  if (channel === 'sms' || channel === 'whatsapp' || channel === 'phone') {
    return normalizePhone(identifier);
  }
  if (channel === 'email') {
    return identifier.toLowerCase().trim();
  }
  return identifier.trim();
}

/**
 * Determine identifier type from channel.
 */
function identifierTypeFromChannel(channel: CommunicationChannel): string {
  if (channel === 'sms' || channel === 'phone') return 'phone';
  if (channel === 'whatsapp') return 'phone'; // WhatsApp uses phone numbers
  if (channel === 'email') return 'email';
  return 'other';
}

export class ContactResolver {
  /**
   * Resolve an identifier (phone/email) to a contact identity.
   * Resolution order:
   * 1. Check contact_identity table (fast path)
   * 2. Search tenant, landlord, leads tables by phone/email
   * 3. Create new unknown contact_identity if not found
   */
  async resolve(identifier: string, channel: CommunicationChannel): Promise<ResolvedContact> {
    const normalized = normalizeIdentifier(identifier, channel);
    const idType = identifierTypeFromChannel(channel);

    // 1. Fast path: check contact_identity table
    const existing = await db
      .select()
      .from(contactIdentities)
      .where(
        and(
          eq(contactIdentities.identifierType, idType),
          eq(contactIdentities.identifierValue, normalized),
        )
      );

    if (existing.length > 0) {
      const row = existing[0];
      return {
        contactIdentityId: row.id,
        contactId: row.contactId,
        contactType: row.contactType,
        identifierValue: row.identifierValue,
      };
    }

    // 2. Search CRM tables for this phone/email
    const crmMatch = await this.searchCrmTables(normalized, idType);
    if (crmMatch) {
      // Create contact_identity row for fast future lookups
      const [newIdentity] = await db
        .insert(contactIdentities)
        .values({
          contactId: crmMatch.contactId,
          contactType: crmMatch.contactType,
          identifierType: idType,
          identifierValue: normalized,
          isPrimary: true,
          verified: true,
        })
        .returning();

      return {
        contactIdentityId: newIdentity.id,
        contactId: newIdentity.contactId,
        contactType: newIdentity.contactType,
        identifierValue: newIdentity.identifierValue,
      };
    }

    // 3. Unknown sender -- create new identity with contactId 0
    const [unknownIdentity] = await db
      .insert(contactIdentities)
      .values({
        contactId: 0,
        contactType: 'unknown',
        identifierType: idType,
        identifierValue: normalized,
        isPrimary: false,
        verified: false,
      })
      .returning();

    return {
      contactIdentityId: unknownIdentity.id,
      contactId: unknownIdentity.contactId,
      contactType: unknownIdentity.contactType,
      identifierValue: unknownIdentity.identifierValue,
    };
  }

  /**
   * Search tenant, landlord, and leads tables for a matching phone/email.
   * Uses raw SQL for cross-table search efficiency.
   */
  private async searchCrmTables(
    normalized: string,
    idType: string,
  ): Promise<{ contactId: number; contactType: string } | null> {
    if (idType === 'phone') {
      // Search tenant table (phone and mobile columns)
      const tenantResult = await pool.query(
        `SELECT id FROM tenant WHERE phone = $1 OR mobile = $1 LIMIT 1`,
        [normalized],
      );
      if (tenantResult.rows.length > 0) {
        return { contactId: tenantResult.rows[0].id, contactType: 'tenant' };
      }

      // Search landlords table (phone and mobile columns)
      const landlordResult = await pool.query(
        `SELECT id FROM landlord WHERE phone = $1 OR mobile = $1 LIMIT 1`,
        [normalized],
      );
      if (landlordResult.rows.length > 0) {
        return { contactId: landlordResult.rows[0].id, contactType: 'landlord' };
      }

      // Search leads table (phone and mobile columns)
      const leadsResult = await pool.query(
        `SELECT id FROM lead WHERE phone = $1 OR mobile = $1 LIMIT 1`,
        [normalized],
      );
      if (leadsResult.rows.length > 0) {
        return { contactId: leadsResult.rows[0].id, contactType: 'lead' };
      }
    } else if (idType === 'email') {
      // Search tenant table
      const tenantResult = await pool.query(
        `SELECT id FROM tenant WHERE email = $1 LIMIT 1`,
        [normalized],
      );
      if (tenantResult.rows.length > 0) {
        return { contactId: tenantResult.rows[0].id, contactType: 'tenant' };
      }

      // Search landlords table
      const landlordResult = await pool.query(
        `SELECT id FROM landlord WHERE email = $1 LIMIT 1`,
        [normalized],
      );
      if (landlordResult.rows.length > 0) {
        return { contactId: landlordResult.rows[0].id, contactType: 'landlord' };
      }

      // Search leads table
      const leadsResult = await pool.query(
        `SELECT id FROM lead WHERE email = $1 LIMIT 1`,
        [normalized],
      );
      if (leadsResult.rows.length > 0) {
        return { contactId: leadsResult.rows[0].id, contactType: 'lead' };
      }
    }

    return null;
  }
}

/** Singleton instance */
export const contactResolver = new ContactResolver();
