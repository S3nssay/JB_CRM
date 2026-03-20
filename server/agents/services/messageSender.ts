/**
 * Message Sender Service
 *
 * Unified outbound message dispatch across WhatsApp, SMS, and email channels.
 * SMS messages are truncated to 320 characters (2 segments max per CONTEXT.md).
 */

import type { CommunicationChannel } from '../types';

const SMS_MAX_LENGTH = 320;

export interface SendOptions {
  subject?: string;
  htmlBody?: string;
}

export class MessageSender {
  /**
   * Send a message via the specified channel.
   */
  async send(
    channel: CommunicationChannel,
    to: string,
    body: string,
    options?: SendOptions,
  ): Promise<boolean> {
    switch (channel) {
      case 'whatsapp':
        return this.sendWhatsApp(to, body);
      case 'sms':
        return this.sendSms(to, body.length > SMS_MAX_LENGTH ? body.slice(0, SMS_MAX_LENGTH - 3) + '...' : body);
      case 'email':
        return this.sendEmail(to, body, options);
      default:
        console.warn(`[MessageSender] Unsupported channel: ${channel}`);
        return false;
    }
  }

  /**
   * Send via preferred channel: try WhatsApp first, fall back to SMS.
   */
  async sendPreferred(phone: string, body: string): Promise<boolean> {
    try {
      return await this.sendWhatsApp(phone, body);
    } catch {
      console.log(`[MessageSender] WhatsApp failed for ${phone}, falling back to SMS`);
      return this.sendSms(
        phone,
        body.length > SMS_MAX_LENGTH ? body.slice(0, SMS_MAX_LENGTH - 3) + '...' : body,
      );
    }
  }

  /**
   * Send via WhatsApp (Twilio).
   */
  private async sendWhatsApp(to: string, body: string): Promise<boolean> {
    try {
      const twilio = await import('twilio');
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromWhatsApp = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

      if (!accountSid || !authToken || !accountSid.startsWith('AC')) {
        console.warn('[MessageSender] Twilio not configured for WhatsApp');
        return false;
      }

      const client = twilio.default(accountSid, authToken);
      const toFormatted = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

      await client.messages.create({
        body,
        from: fromWhatsApp,
        to: toFormatted,
      });

      return true;
    } catch (err) {
      console.error('[MessageSender] WhatsApp send failed:', err);
      throw err; // Re-throw so sendPreferred can catch and fallback
    }
  }

  /**
   * Send via SMS (Twilio).
   */
  private async sendSms(to: string, body: string): Promise<boolean> {
    try {
      const twilio = await import('twilio');
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.TWILIO_PHONE_NUMBER;

      if (!accountSid || !authToken || !accountSid.startsWith('AC')) {
        console.warn('[MessageSender] Twilio not configured for SMS');
        return false;
      }

      const client = twilio.default(accountSid, authToken);
      await client.messages.create({
        body,
        from: fromNumber,
        to,
      });

      return true;
    } catch (err) {
      console.error('[MessageSender] SMS send failed:', err);
      return false;
    }
  }

  /**
   * Send via email (Nodemailer/EmailService).
   */
  private async sendEmail(to: string, body: string, options?: SendOptions): Promise<boolean> {
    try {
      const { emailService } = await import('../../emailService');
      const subject = options?.subject || 'Message from John Barclay Estate Agents';
      const html = options?.htmlBody || `<p>${body.replace(/\n/g, '<br>')}</p>`;

      const result = await emailService.sendEmail(to, subject, html);
      return result.success;
    } catch (err) {
      console.error('[MessageSender] Email send failed:', err);
      return false;
    }
  }
}

/** Singleton instance */
export const messageSender = new MessageSender();
