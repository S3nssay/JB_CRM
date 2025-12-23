import nodemailer from 'nodemailer';
import { db } from './db';
import {
  messages,
  conversations,
  customerEnquiries,
  communicationTemplates
} from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { openaiClient, isOpenAIConfigured } from './lib/openaiClient';

// Initialize OpenAI for email classification
const openai = openaiClient;

// Email configuration types
interface ImapConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  tls: boolean;
}

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  secure: boolean;
}

/**
 * Email Service using IMAP for receiving and SMTP for sending
 * Handles all email communications for the estate agency
 */
export class EmailService {
  private smtpTransporter: nodemailer.Transporter | null = null;
  private imapConfig: ImapConfig | null = null;
  private isConfigured: boolean = false;

  // Email templates
  private readonly TEMPLATES = {
    viewing_confirmation: {
      subject: 'Viewing Confirmation - {{address}}',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1a365d; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">John Barclay</h1>
            <p style="margin: 5px 0;">Estate & Management</p>
          </div>
          <div style="padding: 30px; background: #f8f9fa;">
            <h2>Your Viewing is Confirmed!</h2>
            <p>Dear {{name}},</p>
            <p>Thank you for booking a viewing with John Barclay Estate Agents.</p>

            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #1a365d; margin-top: 0;">Viewing Details</h3>
              <p><strong>Property:</strong> {{address}}</p>
              <p><strong>Date:</strong> {{date}}</p>
              <p><strong>Time:</strong> {{time}}</p>
              <p><strong>Your Agent:</strong> {{agent_name}}</p>
            </div>

            <h3>What to Expect</h3>
            <ul>
              <li>The viewing will last approximately 20-30 minutes</li>
              <li>Feel free to bring a family member or friend</li>
              <li>Take photos and ask any questions you have</li>
            </ul>

            <p>If you need to reschedule, please reply to this email or call us on 020 7123 4567.</p>

            <p style="margin-top: 30px;">Best regards,<br>The John Barclay Team</p>
          </div>
          <div style="background: #1a365d; color: white; padding: 15px; text-align: center; font-size: 12px;">
            <p>John Barclay Estate & Management | 123 High Street, London W9 1AB</p>
            <p>020 7123 4567 | info@johnbarclay.co.uk</p>
          </div>
        </div>
      `
    },
    valuation_report: {
      subject: 'Your Property Valuation - {{address}}',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1a365d; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">John Barclay</h1>
            <p style="margin: 5px 0;">Estate & Management</p>
          </div>
          <div style="padding: 30px; background: #f8f9fa;">
            <h2>Your Property Valuation Report</h2>
            <p>Dear {{name}},</p>
            <p>Thank you for choosing John Barclay for your property valuation. Please find your report below.</p>

            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #1a365d; margin-top: 0;">Property Details</h3>
              <p><strong>Address:</strong> {{address}}</p>
              <p><strong>Property Type:</strong> {{property_type}}</p>
              <p><strong>Bedrooms:</strong> {{bedrooms}}</p>
            </div>

            <div style="background: #1a365d; color: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
              <h3 style="margin-top: 0;">Estimated Value</h3>
              <p style="font-size: 36px; font-weight: bold; margin: 10px 0;">{{valuation_range}}</p>
            </div>

            <h3>Market Analysis</h3>
            <p>{{market_analysis}}</p>

            <h3>Our Recommendations</h3>
            <p>{{recommendations}}</p>

            <div style="text-align: center; margin-top: 30px;">
              <a href="{{cta_link}}" style="background: #1a365d; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Book a Follow-up Call
              </a>
            </div>

            <p style="margin-top: 30px;">Best regards,<br>{{agent_name}}<br>Senior Valuer</p>
          </div>
          <div style="background: #1a365d; color: white; padding: 15px; text-align: center; font-size: 12px;">
            <p>John Barclay Estate & Management | 123 High Street, London W9 1AB</p>
          </div>
        </div>
      `
    },
    new_property_alert: {
      subject: 'New Property Match: {{property_title}}',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1a365d; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">New Property Alert!</h1>
          </div>
          <div style="padding: 30px; background: #f8f9fa;">
            <p>Dear {{name}},</p>
            <p>Great news! A new property matching your criteria has just been listed.</p>

            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2 style="color: #1a365d; margin-top: 0;">{{property_title}}</h2>
              <p><strong>📍 Location:</strong> {{address}}</p>
              <p><strong>💷 Price:</strong> {{price}}</p>
              <p><strong>🛏️ Bedrooms:</strong> {{bedrooms}}</p>
              <p><strong>🛁 Bathrooms:</strong> {{bathrooms}}</p>
              <p style="margin-top: 15px;">{{description}}</p>
            </div>

            <div style="text-align: center; margin: 20px 0;">
              <a href="{{property_link}}" style="background: #1a365d; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 5px;">
                View Property
              </a>
              <a href="{{booking_link}}" style="background: #38a169; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 5px;">
                Book Viewing
              </a>
            </div>

            <p>Best regards,<br>The John Barclay Team</p>
          </div>
        </div>
      `
    },
    enquiry_followup: {
      subject: 'Following up on your property enquiry',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1a365d; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">John Barclay</h1>
          </div>
          <div style="padding: 30px; background: #f8f9fa;">
            <p>Dear {{name}},</p>
            <p>Thank you for your recent enquiry about properties in {{area}}.</p>
            <p>I wanted to follow up and see if you had any questions or would like to arrange some viewings.</p>

            <p>Based on your requirements, I've attached some properties that may interest you.</p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="{{properties_link}}" style="background: #1a365d; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                View Matching Properties
              </a>
            </div>

            <p>Feel free to reply to this email or call me directly on {{agent_phone}}.</p>

            <p>Best regards,<br>{{agent_name}}<br>{{agent_title}}</p>
          </div>
        </div>
      `
    }
  };

  constructor() {
    this.configure();
  }

  /**
   * Configure email service from environment variables
   */
  private configure(): void {
    // IMAP configuration for receiving emails
    if (process.env.IMAP_HOST && process.env.IMAP_USER && process.env.IMAP_PASSWORD) {
      this.imapConfig = {
        host: process.env.IMAP_HOST,
        port: parseInt(process.env.IMAP_PORT || '993'),
        user: process.env.IMAP_USER,
        password: process.env.IMAP_PASSWORD,
        tls: process.env.IMAP_TLS !== 'false'
      };
    }

    // SMTP configuration for sending emails
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
      this.smtpTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD
        }
      });

      this.isConfigured = true;
      console.log('Email service configured successfully');
    } else {
      console.log('Email service not configured - missing SMTP credentials');
    }
  }

  /**
   * Send a plain email
   */
  async sendEmail(
    to: string,
    subject: string,
    html: string,
    options?: {
      cc?: string;
      bcc?: string;
      replyTo?: string;
      attachments?: any[];
      conversationId?: number;
    }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.smtpTransporter) {
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const mailOptions = {
        from: process.env.SMTP_FROM || 'John Barclay <noreply@johnbarclay.co.uk>',
        to,
        subject,
        html,
        cc: options?.cc,
        bcc: options?.bcc,
        replyTo: options?.replyTo,
        attachments: options?.attachments
      };

      const result = await this.smtpTransporter.sendMail(mailOptions);

      // Store in messages table
      if (options?.conversationId) {
        await db.insert(messages).values({
          conversationId: options.conversationId,
          channel: 'email',
          direction: 'outbound',
          fromAddress: process.env.SMTP_FROM,
          toAddress: to,
          subject,
          content: this.stripHtml(html),
          contentHtml: html,
          status: 'sent',
          sentAt: new Date(),
          externalMessageId: result.messageId
        });
      }

      console.log(`Email sent to ${to}: ${result.messageId}`);
      return { success: true, messageId: result.messageId };
    } catch (error: any) {
      console.error('Error sending email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send a templated email
   */
  async sendTemplatedEmail(
    to: string,
    templateName: string,
    variables: Record<string, string>,
    options?: {
      cc?: string;
      attachments?: any[];
      conversationId?: number;
    }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const template = this.TEMPLATES[templateName as keyof typeof this.TEMPLATES];
    if (!template) {
      return { success: false, error: `Template ${templateName} not found` };
    }

    let subject = template.subject;
    let html = template.html;

    // Replace variables
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      subject = subject.replace(regex, value);
      html = html.replace(regex, value);
    }

    return this.sendEmail(to, subject, html, options);
  }

  /**
   * Send bulk emails (e.g., property alerts)
   */
  async sendBulkEmails(
    recipients: Array<{ email: string; variables: Record<string, string> }>,
    templateName: string,
    options?: { delayMs?: number }
  ): Promise<{ success: boolean; sent: number; failed: number; errors: string[] }> {
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const recipient of recipients) {
      const result = await this.sendTemplatedEmail(
        recipient.email,
        templateName,
        recipient.variables
      );

      if (result.success) {
        sent++;
      } else {
        failed++;
        errors.push(`${recipient.email}: ${result.error}`);
      }

      // Rate limiting
      if (options?.delayMs) {
        await new Promise(resolve => setTimeout(resolve, options.delayMs));
      } else {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return { success: failed === 0, sent, failed, errors };
  }

  /**
   * Classify incoming email using AI
   */
  async classifyEmail(
    from: string,
    subject: string,
    body: string
  ): Promise<{
    category: string;
    priority: string;
    suggestedAction: string;
    extractedInfo: any;
  }> {
    try {
      const prompt = `Classify this incoming email for an estate agency:

From: ${from}
Subject: ${subject}
Body: ${body}

Return JSON with:
- category: one of [property_enquiry, viewing_request, valuation_request, maintenance, complaint, general, spam]
- priority: one of [high, medium, low]
- suggestedAction: brief action to take
- extractedInfo: {
    name: sender's name if mentioned,
    phone: phone number if mentioned,
    propertyType: if mentioned,
    budget: if mentioned,
    area: if mentioned,
    urgency: any urgency indicators
  }`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      });

      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (error) {
      console.error('Error classifying email:', error);
      return {
        category: 'general',
        priority: 'medium',
        suggestedAction: 'Review manually',
        extractedInfo: {}
      };
    }
  }

  /**
   * Process incoming email and create appropriate records
   */
  async processIncomingEmail(emailData: {
    from: string;
    to: string;
    subject: string;
    body: string;
    html?: string;
    messageId: string;
    date: Date;
  }): Promise<{ success: boolean; conversationId?: number; enquiryId?: number }> {
    try {
      // Classify the email
      const classification = await this.classifyEmail(
        emailData.from,
        emailData.subject,
        emailData.body
      );

      // Skip spam
      if (classification.category === 'spam') {
        console.log(`Spam email from ${emailData.from} discarded`);
        return { success: true };
      }

      // Find or create conversation
      const conversation = await this.findOrCreateConversation(emailData.from);

      // Store message
      await db.insert(messages).values({
        conversationId: conversation.id,
        channel: 'email',
        direction: 'inbound',
        fromAddress: emailData.from,
        toAddress: emailData.to,
        subject: emailData.subject,
        content: emailData.body,
        contentHtml: emailData.html,
        status: 'delivered',
        deliveredAt: emailData.date,
        externalMessageId: emailData.messageId,
        metadata: { classification }
      });

      // Update conversation
      await db.update(conversations)
        .set({
          lastMessageAt: emailData.date,
          lastMessagePreview: emailData.subject,
          unreadCount: sql`${conversations.unreadCount} + 1`,
          priority: classification.priority,
          updatedAt: new Date()
        })
        .where(eq(conversations.id, conversation.id));

      // Create enquiry if it's a property-related email
      let enquiryId: number | undefined;
      if (['property_enquiry', 'viewing_request', 'valuation_request'].includes(classification.category)) {
        const [enquiry] = await db.insert(customerEnquiries).values({
          source: 'email',
          sourceDetails: emailData.subject,
          customerName: classification.extractedInfo.name || this.extractNameFromEmail(emailData.from),
          customerEmail: emailData.from,
          customerPhone: classification.extractedInfo.phone || '',
          enquiryType: this.mapCategoryToEnquiryType(classification.category),
          message: emailData.body,
          budget: classification.extractedInfo.budget,
          requirements: classification.extractedInfo,
          status: 'new',
          leadScore: classification.priority === 'high' ? 80 : classification.priority === 'medium' ? 60 : 40,
          leadTemperature: classification.priority === 'high' ? 'hot' : 'warm'
        }).returning();

        enquiryId = enquiry.id;
      }

      // Send auto-response if appropriate
      if (classification.category !== 'spam' && classification.priority !== 'low') {
        await this.sendAutoResponse(emailData.from, classification.category, conversation.id);
      }

      return { success: true, conversationId: conversation.id, enquiryId };
    } catch (error) {
      console.error('Error processing incoming email:', error);
      return { success: false };
    }
  }

  /**
   * Find or create conversation for an email address
   */
  private async findOrCreateConversation(email: string): Promise<any> {
    const [existing] = await db.select()
      .from(conversations)
      .where(eq(conversations.contactEmail, email))
      .orderBy(desc(conversations.updatedAt))
      .limit(1);

    if (existing) {
      return existing;
    }

    const [newConvo] = await db.insert(conversations).values({
      contactEmail: email,
      contactName: this.extractNameFromEmail(email),
      status: 'open',
      priority: 'normal'
    }).returning();

    return newConvo;
  }

  /**
   * Extract name from email address
   */
  private extractNameFromEmail(email: string): string {
    const localPart = email.split('@')[0];
    const parts = localPart.split(/[._-]/);
    return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
  }

  /**
   * Map email category to enquiry type
   */
  private mapCategoryToEnquiryType(category: string): string {
    const mapping: Record<string, string> = {
      'property_enquiry': 'buying',
      'viewing_request': 'buying',
      'valuation_request': 'selling',
      'maintenance': 'general',
      'general': 'general'
    };
    return mapping[category] || 'general';
  }

  /**
   * Send automatic response based on email category
   */
  private async sendAutoResponse(
    to: string,
    category: string,
    conversationId: number
  ): Promise<void> {
    const autoResponses: Record<string, { subject: string; body: string }> = {
      property_enquiry: {
        subject: 'Re: Your Property Enquiry - John Barclay Estate Agents',
        body: `Thank you for your enquiry. One of our property specialists will be in touch within 2 hours during business hours (9am-6pm, Monday-Saturday).

In the meantime, you can browse our latest properties at www.johnbarclay.co.uk

Best regards,
The John Barclay Team`
      },
      viewing_request: {
        subject: 'Re: Viewing Request Received - John Barclay',
        body: `Thank you for your viewing request. Our team will contact you shortly to confirm availability.

If urgent, please call us on 020 7123 4567.

Best regards,
The John Barclay Team`
      },
      valuation_request: {
        subject: 'Re: Valuation Request - John Barclay',
        body: `Thank you for requesting a property valuation. One of our senior valuers will be in touch within 24 hours to arrange a convenient time.

Our valuations are free and without obligation.

Best regards,
The John Barclay Team`
      }
    };

    const response = autoResponses[category];
    if (response) {
      await this.sendEmail(
        to,
        response.subject,
        `<div style="font-family: Arial, sans-serif; padding: 20px;">
          <p>${response.body.replace(/\n/g, '<br>')}</p>
        </div>`,
        { conversationId }
      );
    }
  }

  /**
   * Strip HTML tags for plain text storage
   */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Get email service status
   */
  getStatus(): { configured: boolean; smtp: boolean; imap: boolean } {
    return {
      configured: this.isConfigured,
      smtp: this.smtpTransporter !== null,
      imap: this.imapConfig !== null
    };
  }

  /**
   * Test SMTP connection
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.smtpTransporter) {
      return { success: false, error: 'SMTP not configured' };
    }

    try {
      await this.smtpTransporter.verify();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();
