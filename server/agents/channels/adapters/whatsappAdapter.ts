/**
 * WhatsApp Channel Adapter
 * Normalises Twilio WhatsApp webhook payloads into NormalizedMessage format.
 * Strips the "whatsapp:" prefix from phone numbers.
 */

import type { NormalizedMessage, ChannelAdapter } from '../types';

/**
 * Twilio WhatsApp webhook payload shape (relevant fields).
 */
interface TwilioWhatsAppPayload {
  From: string;       // e.g. "whatsapp:+447700900000"
  To: string;         // e.g. "whatsapp:+441234567890"
  Body: string;
  MessageSid: string;
  NumMedia?: string;
  [key: string]: any;
}

/**
 * Strip "whatsapp:" prefix from a Twilio WhatsApp address.
 */
function stripWhatsAppPrefix(address: string): string {
  if (address.startsWith('whatsapp:')) {
    return address.slice('whatsapp:'.length);
  }
  return address;
}

export class WhatsAppAdapter implements ChannelAdapter {
  normalize(payload: unknown): NormalizedMessage {
    const p = payload as TwilioWhatsAppPayload;

    return {
      from: stripWhatsAppPrefix(p.From),
      body: p.Body || '',
      channel: 'whatsapp',
      externalId: p.MessageSid,
      timestamp: new Date(),
      metadata: {
        to: stripWhatsAppPrefix(p.To),
        numMedia: p.NumMedia ? parseInt(p.NumMedia, 10) : 0,
      },
    };
  }
}
