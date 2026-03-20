/**
 * Pre-call Context Loader
 * Resolves phone numbers to CRM contacts and loads conversation history
 * for known callers. Provides context to voice agents during live calls.
 */

import { contactResolver } from '../channels/contactResolver';
import { conversationStore } from '../channels/conversationStore';
import { pool } from '../../db';

export interface CallerContext {
  contactName: string | null;
  contactType: string;
  contactId: number;
  recentSummary: string | null;
  conversationId: number | null;
}

/**
 * Load pre-call context for a phone number.
 * Returns null for unknown callers (graceful degradation).
 */
export async function loadCallerContext(phoneNumber: string): Promise<CallerContext | null> {
  try {
    // 1. Resolve phone to contact identity
    const contact = await contactResolver.resolve(phoneNumber, 'phone');

    // Unknown caller (contactId === 0)
    if (contact.contactId === 0) {
      return null;
    }

    // 2. Look up contact name based on type
    let contactName: string | null = null;
    try {
      const tableName = getTableForContactType(contact.contactType);
      if (tableName) {
        const nameResult = await pool.query(
          `SELECT name FROM ${tableName} WHERE id = $1 LIMIT 1`,
          [contact.contactId],
        );
        if (nameResult.rows.length > 0) {
          contactName = nameResult.rows[0].name;
        }
      }
    } catch {
      // Name lookup failure is non-critical
    }

    // 3. Find or create conversation
    let conversationId: number | null = null;
    let recentSummary: string | null = null;

    try {
      const conversation = await conversationStore.findOrCreateConversation(contact, 'phone');
      conversationId = conversation.id;

      // 4. Load recent history for existing conversations
      if (!conversation.isNew) {
        const history = await conversationStore.getConversationHistory(conversation.id, 5);
        if (history.length > 0) {
          recentSummary = buildSummary(history);
        }
      }
    } catch {
      // Conversation lookup failure is non-critical
    }

    return {
      contactName,
      contactType: contact.contactType,
      contactId: contact.contactId,
      recentSummary,
      conversationId,
    };
  } catch {
    // Total failure: return null (graceful degradation)
    return null;
  }
}

/**
 * Map contact type to database table name.
 */
function getTableForContactType(contactType: string): string | null {
  switch (contactType) {
    case 'tenant':
      return 'tenant';
    case 'landlord':
      return 'landlord';
    case 'lead':
      return 'lead';
    default:
      return null;
  }
}

/**
 * Build a brief summary from recent conversation messages.
 * Takes last 2-3 messages and creates a max 200 char preview.
 */
function buildSummary(history: Array<{ content?: string; direction?: string }>): string {
  const recent = history.slice(0, 3);
  const parts = recent
    .filter((msg) => msg.content)
    .map((msg) => {
      const prefix = msg.direction === 'inbound' ? 'Caller' : 'Agent';
      const preview = (msg.content || '').slice(0, 60);
      return `${prefix}: ${preview}`;
    });

  const summary = parts.join(' | ');
  return summary.slice(0, 200);
}
