import { db } from '../db.js';
import { pool } from '../db.js';
import { communications } from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { emailService } from '../emailService.js';
import { collaborationHub } from '../collaborationHubService.js';

// Lazy imports for Twilio services to avoid startup issues when env vars missing
async function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return null;
  const twilio = await import('twilio');
  return twilio.default(accountSid, authToken);
}

// ==========================================
// Types
// ==========================================

export interface SendMessageParams {
  channel: 'email' | 'sms' | 'whatsapp' | 'phone' | 'note' | 'in_person';
  to: string; // email address or phone number
  content: string;
  subject?: string;
  cc?: string;
  contentHtml?: string;
  templateName?: string;
  templateVars?: Record<string, string>;
  entityType: 'tenant' | 'landlord' | 'lead' | 'property' | 'maintenance';
  entityId: number;
  contactName?: string;
  staffUserId: number;
}

export interface LogCommunicationParams {
  channel: 'phone' | 'note' | 'in_person' | 'email' | 'sms' | 'whatsapp';
  direction: 'inbound' | 'outbound';
  content: string;
  subject?: string;
  entityType: 'tenant' | 'landlord' | 'lead' | 'property' | 'maintenance';
  entityId: number;
  contactName?: string;
  staffUserId: number;
  externalMessageId?: string;
  metadata?: Record<string, any>;
}

export interface CommunicationRecord {
  id: number;
  source: string;
  channel: string;
  direction: string;
  content: string;
  subject: string | null;
  status: string;
  timestamp: string;
  contactName: string | null;
  staffUserId: number | null;
  externalMessageId: string | null;
  metadata: any;
  // Voice call specific
  duration?: number;
  recordingUrl?: string;
  aiSummary?: string;
  transcript?: string;
}

export interface GetHistoryOptions {
  channel?: string;
  limit?: number;
  offset?: number;
}

// ==========================================
// Entity FK mapping helper
// ==========================================

function getEntityFKs(entityType: string, entityId: number): Record<string, number> {
  switch (entityType) {
    case 'tenant': return { tenantId: entityId };
    case 'landlord': return { landlordId: entityId };
    case 'property': return { propertyId: entityId };
    case 'maintenance': return { maintenanceRequestId: entityId };
    case 'lead': return { leadId: entityId };
    default: return {};
  }
}

function getEntityWhereClause(entityType: string, entityId: number): string {
  switch (entityType) {
    case 'tenant': return `c.tenant_id = ${entityId}`;
    case 'landlord': return `c.landlord_id = ${entityId}`;
    case 'property': return `c.property_id = ${entityId}`;
    case 'maintenance': return `c.maintenance_request_id = ${entityId}`;
    case 'lead': return `c.lead_id = ${entityId}`;
    default: return 'FALSE';
  }
}

// ==========================================
// Send via channel
// ==========================================

export async function send(params: SendMessageParams): Promise<{
  success: boolean;
  communicationId?: number;
  externalMessageId?: string;
  error?: string;
}> {
  const { channel, to, content, subject, cc, contentHtml, entityType, entityId, staffUserId, contactName } = params;
  let externalMessageId: string | undefined;
  let status = 'sent';

  try {
    switch (channel) {
      case 'email': {
        const result = await emailService.sendEmail(
          to,
          subject || 'No Subject',
          contentHtml || content,
          { cc: cc || undefined }
        );
        if (!result.success) {
          status = 'failed';
          return { success: false, error: result.error || 'Email send failed' };
        }
        externalMessageId = result.messageId;
        break;
      }

      case 'whatsapp': {
        const result = await collaborationHub.sendWhatsAppMessage(to, content);
        if (!result.success) {
          status = 'failed';
          return { success: false, error: result.error || 'WhatsApp send failed' };
        }
        externalMessageId = result.messageId;
        break;
      }

      case 'sms': {
        const client = await getTwilioClient();
        if (!client) {
          return { success: false, error: 'Twilio not configured' };
        }
        const message = await client.messages.create({
          body: content,
          to: to,
          from: process.env.TWILIO_PHONE_NUMBER,
        });
        externalMessageId = message.sid;
        break;
      }

      case 'note':
      case 'in_person': {
        // No external send needed, just log
        break;
      }

      case 'phone': {
        // Phone calls initiated via separate /calls/initiate endpoint
        // This just logs the record
        break;
      }
    }

    // Log to communications table
    const entityFKs = getEntityFKs(entityType, entityId);
    const [record] = await db.insert(communications).values({
      type: channel === 'whatsapp' ? 'sms' : channel === 'in_person' ? 'note' : channel,
      channel: channel,
      direction: 'outbound',
      content: content,
      subject: subject || null,
      status: status,
      staffUserId: staffUserId,
      externalMessageId: externalMessageId || null,
      ...entityFKs,
    }).returning({ id: communications.id });

    return {
      success: true,
      communicationId: record.id,
      externalMessageId,
    };
  } catch (error: any) {
    console.error(`[UnifiedComms] Send ${channel} failed:`, error.message);
    return { success: false, error: error.message };
  }
}

// ==========================================
// Get unified communication history
// ==========================================

export async function getHistory(
  entityType: string,
  entityId: number,
  options: GetHistoryOptions = {}
): Promise<CommunicationRecord[]> {
  const { channel, limit = 50, offset = 0 } = options;
  const entityWhere = getEntityWhereClause(entityType, entityId);

  // Build channel filter
  let channelFilter = '';
  if (channel && channel !== 'all') {
    if (channel === 'phone') {
      channelFilter = `AND (c.channel = 'phone' OR c.type = 'phone')`;
    } else {
      channelFilter = `AND (c.channel = '${channel}' OR c.type = '${channel}')`;
    }
  }

  // Main communications query
  let query = `
    SELECT
      c.id,
      'communication' as source,
      COALESCE(c.channel, c.type) as channel,
      c.direction,
      c.content,
      c.subject,
      c.status,
      c.created_at as timestamp,
      c.staff_user_id,
      c.external_message_id,
      c.metadata,
      NULL::integer as duration,
      NULL::text as recording_url,
      NULL::text as ai_summary,
      NULL::text as transcript
    FROM communication c
    WHERE ${entityWhere} ${channelFilter}
  `;

  // For leads, also pull from lead_communication table
  if (entityType === 'lead') {
    const leadChannelFilter = channel && channel !== 'all' ? `AND lc.channel = '${channel}'` : '';
    query += `
    UNION ALL
    SELECT
      lc.id,
      'lead_communication' as source,
      lc.channel,
      lc.direction,
      lc.content,
      lc.subject,
      'sent' as status,
      lc.created_at as timestamp,
      lc.handled_by as staff_user_id,
      lc.external_message_id,
      NULL::json as metadata,
      NULL::integer as duration,
      NULL::text as recording_url,
      NULL::text as ai_summary,
      NULL::text as transcript
    FROM lead_communication lc
    WHERE lc.lead_id = $1 ${leadChannelFilter}
    AND NOT EXISTS (
      SELECT 1 FROM communication c2
      WHERE c2.lead_id = $1
      AND c2.external_message_id = lc.external_message_id
      AND lc.external_message_id IS NOT NULL
    )
    `;
  }

  // Include voice call records for all entity types (linked via leads or standalone)
  if (!channel || channel === 'all' || channel === 'phone') {
    if (entityType === 'lead') {
      query += `
      UNION ALL
      SELECT
        vcr.id,
        'voice_call' as source,
        'phone' as channel,
        vcr.direction,
        COALESCE(vcr.ai_summary, vcr.transcript, 'Voice call') as content,
        NULL as subject,
        vcr.status,
        vcr.started_at as timestamp,
        NULL::integer as staff_user_id,
        vcr.call_sid as external_message_id,
        NULL::json as metadata,
        vcr.duration,
        vcr.recording_url,
        vcr.ai_summary,
        vcr.transcript
      FROM voice_call_record vcr
      WHERE vcr.lead_id = $1
      `;
    }
  }

  query += `
    ORDER BY timestamp DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const params = entityType === 'lead' ? [entityId] : [];
  // For non-lead entities, we used inline values in WHERE clause (via getEntityWhereClause)
  // For lead, we use $1 parameter
  const result = await pool.query(query, params);

  return result.rows.map((row: any) => ({
    id: row.id,
    source: row.source,
    channel: row.channel,
    direction: row.direction,
    content: row.content,
    subject: row.subject,
    status: row.status,
    timestamp: row.timestamp,
    contactName: null,
    staffUserId: row.staff_user_id,
    externalMessageId: row.external_message_id,
    metadata: row.metadata,
    duration: row.duration,
    recordingUrl: row.recording_url,
    aiSummary: row.ai_summary,
    transcript: row.transcript,
  }));
}

// ==========================================
// Log manual communication
// ==========================================

export async function logManual(params: LogCommunicationParams): Promise<{
  success: boolean;
  communicationId?: number;
}> {
  const { channel, direction, content, subject, entityType, entityId, staffUserId, externalMessageId, metadata } = params;
  const entityFKs = getEntityFKs(entityType, entityId);

  try {
    const [record] = await db.insert(communications).values({
      type: channel === 'whatsapp' ? 'sms' : channel === 'in_person' ? 'note' : channel,
      channel: channel,
      direction: direction,
      content: content,
      subject: subject || null,
      status: direction === 'inbound' ? 'received' : 'sent',
      staffUserId: staffUserId,
      externalMessageId: externalMessageId || null,
      metadata: metadata || null,
      ...entityFKs,
    }).returning({ id: communications.id });

    return { success: true, communicationId: record.id };
  } catch (error: any) {
    console.error('[UnifiedComms] Log manual failed:', error.message);
    return { success: false };
  }
}

// ==========================================
// Lookup contact by phone number (for caller ID popup)
// ==========================================

export async function lookupContactByPhone(phone: string): Promise<{
  found: boolean;
  contacts: Array<{
    entityType: string;
    entityId: number;
    name: string;
    email: string | null;
    phone: string;
    additionalInfo?: Record<string, any>;
  }>;
}> {
  // Normalize phone number - strip spaces, dashes, and ensure +44 format
  const normalized = phone.replace(/[\s\-()]/g, '');
  const variants = [normalized];

  // Add UK format variants
  if (normalized.startsWith('+44')) {
    variants.push('0' + normalized.slice(3));
    variants.push(normalized.slice(3));
  } else if (normalized.startsWith('0')) {
    variants.push('+44' + normalized.slice(1));
    variants.push(normalized.slice(1));
  }

  const phonePlaceholders = variants.map((_, i) => `$${i + 1}`).join(', ');
  const contacts: any[] = [];

  // Search tenants
  const tenantResult = await pool.query(
    `SELECT id, name, email, phone, mobile FROM tenant
     WHERE phone IN (${phonePlaceholders}) OR mobile IN (${phonePlaceholders})`,
    [...variants, ...variants]
  );
  for (const row of tenantResult.rows) {
    contacts.push({
      entityType: 'tenant',
      entityId: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone || row.mobile,
    });
  }

  // Search landlords
  const landlordResult = await pool.query(
    `SELECT id, name, email, phone, mobile FROM landlords
     WHERE phone IN (${phonePlaceholders}) OR mobile IN (${phonePlaceholders})`,
    [...variants, ...variants]
  );
  for (const row of landlordResult.rows) {
    contacts.push({
      entityType: 'landlord',
      entityId: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone || row.mobile,
    });
  }

  // Search leads
  const leadResult = await pool.query(
    `SELECT id, name, email, phone, mobile, status, lead_type FROM lead
     WHERE phone IN (${phonePlaceholders}) OR mobile IN (${phonePlaceholders})`,
    [...variants, ...variants]
  );
  for (const row of leadResult.rows) {
    contacts.push({
      entityType: 'lead',
      entityId: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone || row.mobile,
      additionalInfo: { status: row.status, leadType: row.lead_type },
    });
  }

  return { found: contacts.length > 0, contacts };
}

// Export as named module
export const unifiedCommunicationService = {
  send,
  getHistory,
  logManual,
  lookupContactByPhone,
};
