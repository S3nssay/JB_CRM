/**
 * Email Channel Adapter
 * Normalises email payloads into NormalizedMessage format for the ChannelGateway.
 */

import type { NormalizedMessage, ChannelAdapter } from '../types';

/**
 * Expected email payload shape (from EmailProcessor or webhook).
 */
interface EmailPayload {
  from: string;
  fromName?: string;
  subject?: string;
  body: string;
  messageId?: string;
}

export class EmailAdapter implements ChannelAdapter {
  normalize(payload: unknown): NormalizedMessage {
    const p = payload as EmailPayload;

    return {
      from: p.from,
      fromName: p.fromName,
      body: p.body || '',
      channel: 'email',
      externalId: p.messageId,
      timestamp: new Date(),
      metadata: {
        subject: p.subject,
      },
    };
  }
}
