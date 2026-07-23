/**
 * SMTP/IMAP Transport Layer
 *
 * Provides SmtpSender (outbound via nodemailer) and ImapPoller (inbound via imapflow)
 * for generic email accounts alongside the M365 Graph API transport.
 */

import nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import { simpleParser, ParsedMail } from 'mailparser';
import { decryptToken } from '../../lib/encryption';

export interface SmtpConnectionConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string; // encrypted
  smtpSecure: boolean;
  mailboxUpn: string; // from address
  mailboxDisplayName?: string; // optional human-readable From name, e.g. "John Barclay Accounts Team"
}

export interface ImapConnectionConfig {
  imapHost: string;
  imapPort: number;
  imapUser: string;
  imapPassword: string; // encrypted
  imapTls: boolean;
}

export interface SmtpSendOptions {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  importance?: 'low' | 'normal' | 'high';
  attachments?: {
    name: string;
    contentType: string;
    contentBytes: string; // base64
  }[];
  replyTo?: string;
  inReplyTo?: string;
}

export interface ImapParsedMessage {
  uid: string;
  messageId: string; // RFC 822 Message-ID
  from: { address: string; name: string };
  to: { address: string; name: string }[];
  cc: { address: string; name: string }[];
  subject: string;
  bodyText: string;
  bodyHtml: string;
  date: Date;
  hasAttachments: boolean;
  attachments: { name: string; contentType: string; size: number }[];
  importance: string;
  inReplyTo?: string;
  references?: string;
}

/**
 * Sends emails via SMTP using nodemailer
 */
export class SmtpSender {
  private createTransporter(config: SmtpConnectionConfig): nodemailer.Transporter {
    const password = decryptToken(config.smtpPassword);
    return nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth: {
        user: config.smtpUser,
        pass: password,
      },
      tls: { rejectUnauthorized: false },
    });
  }

  async sendEmail(
    config: SmtpConnectionConfig,
    options: SmtpSendOptions
  ): Promise<{ messageId: string }> {
    const transporter = this.createTransporter(config);

    const priorityMap: Record<string, string> = {
      high: 'high',
      low: 'low',
      normal: 'normal',
    };

    const mailOptions: nodemailer.SendMailOptions = {
      from: config.mailboxDisplayName
        ? { name: config.mailboxDisplayName, address: config.mailboxUpn }
        : config.mailboxUpn,
      to: options.to.join(', '),
      cc: options.cc?.join(', '),
      bcc: options.bcc?.join(', '),
      subject: options.subject,
      text: options.bodyText,
      html: options.bodyHtml,
      replyTo: options.replyTo,
      inReplyTo: options.inReplyTo,
      priority: priorityMap[options.importance || 'normal'] as any,
      attachments: options.attachments?.map((a) => ({
        filename: a.name,
        content: Buffer.from(a.contentBytes, 'base64'),
        contentType: a.contentType,
      })),
    };

    const result = await transporter.sendMail(mailOptions);
    transporter.close();

    return { messageId: result.messageId };
  }

  async verifyConnection(config: SmtpConnectionConfig): Promise<{ success: boolean; error?: string }> {
    try {
      const transporter = this.createTransporter(config);
      await transporter.verify();
      transporter.close();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Test SMTP connection with raw (unencrypted) credentials.
   * Used for the test-smtp endpoint before credentials are saved.
   */
  async testRawConnection(config: {
    host: string;
    port: number;
    user: string;
    password: string;
    secure: boolean;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.user,
          pass: config.password,
        },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 15000,
      });
      await transporter.verify();
      transporter.close();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

/**
 * Fetches emails via IMAP using imapflow
 */
export class ImapPoller {
  async fetchNewEmails(
    config: ImapConnectionConfig,
    lastUid?: string | null
  ): Promise<{ messages: ImapParsedMessage[]; highestUid: string }> {
    const password = decryptToken(config.imapPassword);

    const client = new ImapFlow({
      host: config.imapHost,
      port: config.imapPort,
      secure: config.imapTls,
      auth: {
        user: config.imapUser,
        pass: password,
      },
      logger: false,
      tls: { rejectUnauthorized: false },
    });

    // Prevent unhandled 'error' events from crashing the process
    client.on('error', (err: any) => {
      console.error('[ImapPoller] IMAP client error:', err.message);
    });

    const messages: ImapParsedMessage[] = [];
    let highestUid = lastUid || '0';

    try {
      await client.connect();

      const lock = await client.getMailboxLock('INBOX');
      try {
        // Search for messages newer than lastUid, or all UNSEEN on first sync
        let searchCriteria: any;
        if (lastUid && lastUid !== '0') {
          // Fetch UIDs greater than the last seen
          searchCriteria = { uid: `${parseInt(lastUid) + 1}:*` };
        } else {
          // First sync: get recent unseen messages (last 50)
          searchCriteria = { unseen: true };
        }

        const messageUids: number[] = [];
        try {
          for await (const msg of client.fetch(searchCriteria, {
            uid: true,
            source: true,
          })) {
            // Skip if we've already seen this UID
            if (lastUid && msg.uid <= parseInt(lastUid)) continue;

            try {
              const parsed = await simpleParser(msg.source);
              const imapMsg = this.parsedMailToMessage(msg.uid.toString(), parsed);
              messages.push(imapMsg);

              if (parseInt(msg.uid.toString()) > parseInt(highestUid)) {
                highestUid = msg.uid.toString();
              }
            } catch (parseErr) {
              console.error(`[ImapPoller] Failed to parse message UID ${msg.uid}:`, parseErr);
            }

            messageUids.push(msg.uid);
            // Limit to 100 messages per poll to avoid memory issues
            if (messageUids.length >= 100) break;
          }
        } catch (fetchErr: any) {
          // If the UID range is invalid (no new messages), that's fine
          if (!fetchErr.message?.includes('UID')) {
            throw fetchErr;
          }
        }
      } finally {
        lock.release();
      }

      await client.logout();
    } catch (error) {
      try { await client.logout(); } catch {}
      throw error;
    }

    return { messages, highestUid };
  }

  private parsedMailToMessage(uid: string, parsed: ParsedMail): ImapParsedMessage {
    const fromAddr = parsed.from?.value?.[0] || { address: '', name: '' };
    const toAddrs = parsed.to
      ? (Array.isArray(parsed.to) ? parsed.to : [parsed.to]).flatMap((t) =>
          t.value.map((v) => ({ address: v.address || '', name: v.name || '' }))
        )
      : [];
    const ccAddrs = parsed.cc
      ? (Array.isArray(parsed.cc) ? parsed.cc : [parsed.cc]).flatMap((t) =>
          t.value.map((v) => ({ address: v.address || '', name: v.name || '' }))
        )
      : [];

    const importance = parsed.headers.get('importance')?.toString() || 'normal';

    return {
      uid,
      messageId: parsed.messageId || `unknown-${uid}`,
      from: { address: fromAddr.address || '', name: fromAddr.name || '' },
      to: toAddrs,
      cc: ccAddrs,
      subject: parsed.subject || '',
      bodyText: parsed.text || '',
      bodyHtml: parsed.html || parsed.textAsHtml || '',
      date: parsed.date || new Date(),
      hasAttachments: (parsed.attachments?.length || 0) > 0,
      attachments: (parsed.attachments || []).map((a) => ({
        name: a.filename || 'unnamed',
        contentType: a.contentType || 'application/octet-stream',
        size: a.size || 0,
      })),
      importance,
      inReplyTo: parsed.inReplyTo,
      references: Array.isArray(parsed.references)
        ? parsed.references.join(' ')
        : parsed.references || undefined,
    };
  }

  async testConnection(config: ImapConnectionConfig): Promise<{ success: boolean; error?: string }> {
    try {
      const password = decryptToken(config.imapPassword);
      const client = new ImapFlow({
        host: config.imapHost,
        port: config.imapPort,
        secure: config.imapTls,
        auth: {
          user: config.imapUser,
          pass: password,
        },
        logger: false,
        tls: { rejectUnauthorized: false },
      });
      client.on('error', (err: any) => { /* handled below */ });

      await client.connect();
      await client.logout();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Test IMAP connection with raw (unencrypted) credentials.
   * Used for the test-smtp endpoint before credentials are saved.
   */
  async testRawConnection(config: {
    host: string;
    port: number;
    user: string;
    password: string;
    tls: boolean;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const client = new ImapFlow({
        host: config.host,
        port: config.port,
        secure: config.tls,
        auth: {
          user: config.user,
          pass: config.password,
        },
        logger: false,
        tls: { rejectUnauthorized: false },
        connectionTimeout: 15000,
      });
      client.on('error', (err: any) => { /* handled below */ });

      await client.connect();
      await client.logout();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

export const smtpSender = new SmtpSender();
export const imapPoller = new ImapPoller();
