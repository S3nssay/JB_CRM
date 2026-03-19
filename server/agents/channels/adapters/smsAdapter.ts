/**
 * SMS Channel Adapter
 * Normalises Twilio SMS webhook payloads into NormalizedMessage format.
 */

import type { NormalizedMessage, ChannelAdapter } from '../types';

/**
 * Twilio SMS webhook payload shape (relevant fields).
 */
interface TwilioSmsPayload {
  From: string;
  To: string;
  Body: string;
  MessageSid: string;
  NumMedia?: string;
  [key: string]: any;
}

export class SmsAdapter implements ChannelAdapter {
  normalize(payload: unknown): NormalizedMessage {
    const p = payload as TwilioSmsPayload;

    return {
      from: p.From,
      body: p.Body || '',
      channel: 'sms',
      externalId: p.MessageSid,
      timestamp: new Date(),
      metadata: {
        to: p.To,
        numMedia: p.NumMedia ? parseInt(p.NumMedia, 10) : 0,
      },
    };
  }
}
