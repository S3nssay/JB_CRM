/**
 * Email Processor Service
 *
 * Processes incoming emails: fetches from Graph API, stores in database,
 * performs AI analysis, and links to CRM entities.
 */

import { db } from '../../db';
import {
  emailConnections,
  processedEmails,
  InsertProcessedEmail,
  conversations,
  customerEnquiries,
  leads,
} from '@shared/schema';
import { eq, and, or, ilike, sql } from 'drizzle-orm';
import { graphAuthService } from '../microsoft/graphAuthService';
import { createGraphClient, GraphMessage } from '../microsoft/graphApiClient';
import { decryptToken } from '../../lib/encryption';
import OpenAI from 'openai';
import type { ImapParsedMessage } from './smtpTransport';

// OpenAI client for AI processing
let openai: OpenAI | null = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export interface ProcessEmailResult {
  success: boolean;
  processedEmailId?: number;
  error?: string;
  linkedConversationId?: number;
  linkedContactId?: number;
  aiResults?: AiAnalysisResult;
}

export interface AiAnalysisResult {
  category: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  priority: 'urgent' | 'high' | 'normal' | 'low';
  summary: string;
  extractedEntities: {
    names?: string[];
    emails?: string[];
    phones?: string[];
    addresses?: string[];
    dates?: string[];
    amounts?: string[];
    propertyReferences?: string[];
  };
  suggestedActions: {
    action: string;
    confidence: number;
    details?: string;
  }[];
  classification: string;
  // AI Agent fields
  actionType: string; // create_support_ticket | add_ticket_comment | create_enquiry | create_viewing | process_contractor_response | route_to_pm | ignore
  senderType: string; // tenant | landlord | contractor | prospect | unknown
  existingTicketReference: string | null; // ticket number if mentioned e.g. JB240101ABCD

  // Enhanced workflow fields
  tasks: {
    title: string;
    taskType: 'viewing' | 'call' | 'follow_up' | 'enquiry_response' | 'document' | 'maintenance' | 'general';
    priority: 'urgent' | 'high' | 'normal' | 'low';
    description: string;
    dueWithinHours: number;
  }[];

  attachmentClassifications: {
    filename: string;
    documentType: 'passport' | 'driving_licence' | 'proof_of_address' | 'bank_statement' |
                  'gas_safety' | 'epc' | 'eicr' | 'tenancy_agreement' | 'inventory' |
                  'invoice' | 'insurance' | 'licence' | 'certificate' | 'photo' |
                  'reference' | 'other';
    entityType: 'landlord' | 'tenant' | 'property' | 'tenancy' | 'unknown';
    confidence: number;
    description: string;
  }[];

  propertyMatch: {
    address: string;
    postcode: string;
    confidence: number;
  } | null;

  leadDetails: {
    leadType: 'rental' | 'purchase' | 'both' | 'landlord' | 'seller';
    budget: string | null;
    bedrooms: number | null;
    areas: string[];
    moveInDate: string | null;
    requirements: string | null;
  } | null;
}

/**
 * Email Processor Service
 */
export class EmailProcessor {
  /**
   * Processes an email notification from Microsoft Graph.
   * Fetches full email data, stores it, and performs AI analysis.
   */
  async processEmail(
    graphMessageId: string,
    connectionId: number,
    userId: number
  ): Promise<ProcessEmailResult> {
    try {
      // Check if already processed (idempotency)
      const existing = await db
        .select()
        .from(processedEmails)
        .where(
          and(
            eq(processedEmails.graphMessageId, graphMessageId),
            eq(processedEmails.connectionId, connectionId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        console.log(`Email ${graphMessageId} already processed, skipping`);
        return {
          success: true,
          processedEmailId: existing[0].id,
        };
      }

      // Get the email connection
      const [connection] = await db
        .select()
        .from(emailConnections)
        .where(eq(emailConnections.id, connectionId))
        .limit(1);

      if (!connection) {
        return { success: false, error: 'Connection not found' };
      }

      if (connection.status !== 'active') {
        return { success: false, error: 'Connection is not active' };
      }

      // Get valid access token (refresh if needed)
      const tokenResult = await graphAuthService.getValidAccessToken(
        connection.accessToken,
        connection.refreshToken,
        connection.tokenExpiresAt,
        connection.tenantId
      );

      // Update tokens if refreshed
      if (tokenResult.needsUpdate) {
        await db
          .update(emailConnections)
          .set({
            accessToken: tokenResult.newAccessToken!,
            refreshToken: tokenResult.newRefreshToken!,
            tokenExpiresAt: tokenResult.newExpiresAt!,
            updatedAt: new Date(),
          })
          .where(eq(emailConnections.id, connectionId));
      }

      // Create Graph client and fetch the message
      const graphClient = createGraphClient(tokenResult.accessToken);
      const message = await graphClient.getMessage(graphMessageId, true);

      // Store the processed email
      const processedEmail = await this.storeProcessedEmail(
        message,
        connectionId,
        userId
      );

      // Try to link to existing CRM conversation/contact
      const linkResult = await this.linkToCRM(processedEmail, userId);

      // Perform AI analysis (async, don't block)
      let aiResults: AiAnalysisResult | undefined;
      if (openai && message.body?.content) {
        try {
          aiResults = await this.performAiAnalysis(message);
          await this.updateWithAiResults(processedEmail.id, aiResults);
        } catch (aiError) {
          console.error('AI analysis failed:', aiError);
          // Don't fail the whole processing for AI errors
        }
      }

      // AI Agent: take action based on analysis results
      if (aiResults) {
        try {
          const { emailAIAgent } = await import('./emailAIAgent');
          await emailAIAgent.processAction(processedEmail.id, aiResults, {
            fromAddress: message.from?.emailAddress?.address || '',
            fromName: message.from?.emailAddress?.name || '',
            subject: message.subject || '',
            bodyText: message.body?.contentType === 'text' ? message.body.content : '',
            bodyHtml: message.body?.contentType === 'html' ? message.body.content : '',
            connectionId,
            userId,
            graphMessageId,
          });
        } catch (agentError) {
          console.error('[EmailAIAgent] Action execution failed:', agentError);
          // Don't fail the whole processing if the agent fails
        }
      }

      // Update sync timestamp on connection
      await db
        .update(emailConnections)
        .set({
          lastSyncAt: new Date(),
          errorCount: 0,
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(emailConnections.id, connectionId));

      return {
        success: true,
        processedEmailId: processedEmail.id,
        linkedConversationId: linkResult.conversationId,
        linkedContactId: linkResult.contactId,
        aiResults,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error processing email ${graphMessageId}:`, errorMessage);

      // Update error count on connection
      await db
        .update(emailConnections)
        .set({
          errorCount: sql`${emailConnections.errorCount} + 1`,
          lastError: errorMessage,
          updatedAt: new Date(),
        })
        .where(eq(emailConnections.id, connectionId));

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Stores a processed email in the database
   */
  private async storeProcessedEmail(
    message: GraphMessage,
    connectionId: number,
    userId: number
  ): Promise<{ id: number }> {
    const emailData: InsertProcessedEmail = {
      connectionId,
      userId,
      graphMessageId: message.id,
      graphConversationId: message.conversationId || null,
      internetMessageId: message.internetMessageId || null,
      fromAddress: message.from?.emailAddress?.address || '',
      fromName: message.from?.emailAddress?.name || null,
      toAddresses: message.toRecipients?.map((r) => r.emailAddress.address) || [],
      ccAddresses: message.ccRecipients?.map((r) => r.emailAddress.address) || null,
      bccAddresses: message.bccRecipients?.map((r) => r.emailAddress.address) || null,
      subject: message.subject || null,
      bodyPreview: message.bodyPreview || null,
      bodyText: message.body?.contentType === 'text' ? message.body.content : null,
      bodyHtml: message.body?.contentType === 'html' ? message.body.content : null,
      hasAttachments: message.hasAttachments,
      attachments: message.attachments
        ? message.attachments.map((a) => ({
            id: a.id,
            name: a.name,
            contentType: a.contentType,
            size: a.size,
            contentId: a.contentId,
          }))
        : null,
      receivedAt: new Date(message.receivedDateTime),
      sentAt: message.sentDateTime ? new Date(message.sentDateTime) : null,
      importance: message.importance,
      categories: message.categories || null,
      isRead: message.isRead || false,
      isDraft: message.isDraft || false,
      folderId: message.parentFolderId || null,
      processingStatus: 'pending',
    };

    const [result] = await db
      .insert(processedEmails)
      .values(emailData)
      .returning({ id: processedEmails.id });

    console.log(`Stored processed email ${result.id} from ${emailData.fromAddress}`);
    return result;
  }

  /**
   * Attempts to link the email to existing CRM entities
   */
  private async linkToCRM(
    email: { id: number; fromAddress: string; subject: string | null },
    userId: number
  ): Promise<{ conversationId?: number; contactId?: number }> {
    const result: { conversationId?: number; contactId?: number } = {};

    // Run all lookups in parallel
    const [existingConversations, existingEnquiries, existingLeads] = await Promise.all([
      db.select().from(conversations)
        .where(or(ilike(conversations.contactEmail, email.fromAddress), ilike(conversations.contactPhone, email.fromAddress)))
        .limit(1),
      db.select().from(customerEnquiries)
        .where(ilike(customerEnquiries.customerEmail, email.fromAddress))
        .limit(1),
      db.select().from(leads)
        .where(ilike(leads.email, email.fromAddress))
        .limit(1),
    ]);

    // Batch all link updates into a single UPDATE
    const linkUpdates: Record<string, number> = {};
    if (existingConversations[0]) {
      result.conversationId = existingConversations[0].id;
      linkUpdates.linkedConversationId = existingConversations[0].id;
    }
    if (existingEnquiries[0]) {
      result.contactId = existingEnquiries[0].id;
      linkUpdates.linkedEnquiryId = existingEnquiries[0].id;
    }
    if (existingLeads[0]) {
      result.contactId = existingLeads[0].id;
      linkUpdates.linkedContactId = existingLeads[0].id;
    }

    if (Object.keys(linkUpdates).length > 0) {
      await db.update(processedEmails)
        .set(linkUpdates)
        .where(eq(processedEmails.id, email.id));
    }

    return result;
  }

  /**
   * Processes an email received via IMAP (SMTP connections).
   * Normalizes IMAP data and feeds it through the same AI pipeline.
   */
  async processSmtpEmail(
    parsedMessage: ImapParsedMessage,
    connectionId: number,
    userId: number,
    department?: string | null
  ): Promise<ProcessEmailResult> {
    const syntheticId = `imap://${connectionId}/${parsedMessage.uid}`;

    try {
      // Check idempotency
      const existing = await db
        .select()
        .from(processedEmails)
        .where(
          and(
            eq(processedEmails.graphMessageId, syntheticId),
            eq(processedEmails.connectionId, connectionId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        return { success: true, processedEmailId: existing[0].id };
      }

      // Store the email
      const emailData: InsertProcessedEmail = {
        connectionId,
        userId,
        graphMessageId: syntheticId,
        graphConversationId: null,
        internetMessageId: parsedMessage.messageId || null,
        fromAddress: parsedMessage.from.address,
        fromName: parsedMessage.from.name || null,
        toAddresses: parsedMessage.to.map((t) => t.address),
        ccAddresses: parsedMessage.cc.length > 0 ? parsedMessage.cc.map((c) => c.address) : null,
        bccAddresses: null,
        subject: parsedMessage.subject || null,
        bodyPreview: (parsedMessage.bodyText || '').substring(0, 200) || null,
        bodyText: parsedMessage.bodyText || null,
        bodyHtml: parsedMessage.bodyHtml || null,
        hasAttachments: parsedMessage.hasAttachments,
        attachments: parsedMessage.attachments.length > 0
          ? parsedMessage.attachments.map((a) => ({
              name: a.name,
              contentType: a.contentType,
              size: a.size,
            }))
          : null,
        receivedAt: parsedMessage.date,
        sentAt: parsedMessage.date,
        importance: parsedMessage.importance || 'normal',
        categories: null,
        isRead: false,
        isDraft: false,
        folderId: 'INBOX',
        processingStatus: 'pending',
      };

      const [processedEmail] = await db
        .insert(processedEmails)
        .values(emailData)
        .returning({ id: processedEmails.id });

      console.log(`Stored SMTP email ${processedEmail.id} from ${emailData.fromAddress}`);

      // Link to CRM (non-blocking — linking failure must not prevent AI processing)
      let linkResult: { conversationId?: number; contactId?: number } = {};
      try {
        linkResult = await this.linkToCRM(
          { id: processedEmail.id, fromAddress: emailData.fromAddress, subject: emailData.subject },
          userId
        );
      } catch (linkError) {
        console.error(`[EmailProcessor] CRM linking failed for email ${processedEmail.id}:`, linkError);
      }

      // AI analysis
      let aiResults: AiAnalysisResult | undefined;
      if (openai && (parsedMessage.bodyText || parsedMessage.bodyHtml)) {
        try {
          const smtpAttachmentNames = parsedMessage.attachments
            .map(a => a.name)
            .filter(Boolean) as string[];
          aiResults = await this.performAiAnalysisRaw(
            parsedMessage.from.address,
            parsedMessage.subject,
            parsedMessage.bodyText || parsedMessage.bodyHtml,
            department,
            smtpAttachmentNames.length > 0 ? smtpAttachmentNames : undefined
          );
          await this.updateWithAiResults(processedEmail.id, aiResults);
        } catch (aiError) {
          console.error('AI analysis failed for SMTP email:', aiError);
        }
      }

      // AI Agent action
      if (aiResults) {
        try {
          const { emailAIAgent } = await import('./emailAIAgent');
          await emailAIAgent.processAction(processedEmail.id, aiResults, {
            fromAddress: parsedMessage.from.address,
            fromName: parsedMessage.from.name,
            subject: parsedMessage.subject,
            bodyText: parsedMessage.bodyText,
            bodyHtml: parsedMessage.bodyHtml,
            connectionId,
            userId,
            graphMessageId: syntheticId,
            department,
          });
        } catch (agentError) {
          console.error('[EmailAIAgent] Action execution failed for SMTP email:', agentError);
        }
      }

      // Update sync timestamp
      await db
        .update(emailConnections)
        .set({
          lastSyncAt: new Date(),
          errorCount: 0,
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(emailConnections.id, connectionId));

      return {
        success: true,
        processedEmailId: processedEmail.id,
        linkedConversationId: linkResult.conversationId,
        linkedContactId: linkResult.contactId,
        aiResults,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error processing SMTP email UID ${parsedMessage.uid}:`, errorMessage);

      await db
        .update(emailConnections)
        .set({
          errorCount: sql`${emailConnections.errorCount} + 1`,
          lastError: errorMessage,
          updatedAt: new Date(),
        })
        .where(eq(emailConnections.id, connectionId));

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Performs AI analysis on the email content (from GraphMessage)
   */
  private async performAiAnalysis(message: GraphMessage, department?: string | null): Promise<AiAnalysisResult> {
    const emailContent = message.body?.content || message.bodyPreview || '';
    const subject = message.subject || '';
    const from = message.from?.emailAddress?.address || '';
    const attachmentNames = message.attachments?.map(a => a.name).filter(Boolean) as string[] | undefined;
    return this.performAiAnalysisRaw(from, subject, emailContent, department, attachmentNames);
  }

  /**
   * Performs AI analysis on raw email content (provider-agnostic)
   */
  private async performAiAnalysisRaw(
    from: string,
    subject: string,
    body: string,
    department?: string | null,
    attachmentNames?: string[]
  ): Promise<AiAnalysisResult> {
    if (!openai) {
      throw new Error('OpenAI not configured');
    }

    const emailContent = body;
    const attachmentList = attachmentNames && attachmentNames.length > 0
      ? `\nAttachments: ${attachmentNames.join(', ')}`
      : '';

    const systemPrompt = `You are an AI agent for John Barclay Estate Agents' CRM in London, UK.
Analyze incoming emails, decide what action to take, identify ALL tasks, classify attachments, and extract lead/property data.

The business handles:
- Property sales and rentals
- Property valuations and viewings
- Landlord and tenant relations
- Property management and maintenance
- Contractor management for repairs

You MUST respond with a JSON object. Every field is required:
{
  "category": "string - one of: property_enquiry, viewing_request, valuation_request, maintenance, support_request, tenant_communication, landlord_communication, contractor_response, offer, contract, general_enquiry, document_submission, spam, auto_reply, other",
  "sentiment": "string - one of: positive, neutral, negative",
  "priority": "string - one of: urgent, high, normal, low. Use urgent for emergencies (flooding, gas leak, no heating, lock-out). Use high for time-sensitive issues.",
  "summary": "string - 1-2 sentence summary of the email",
  "extractedEntities": {
    "names": ["person names mentioned"],
    "emails": ["email addresses mentioned"],
    "phones": ["phone numbers mentioned"],
    "addresses": ["property addresses mentioned"],
    "dates": ["dates mentioned"],
    "amounts": ["monetary amounts mentioned e.g. £500"],
    "propertyReferences": ["property IDs or references"]
  },
  "suggestedActions": [
    {"action": "string", "confidence": 0.0, "details": "string"}
  ],
  "classification": "string - business classification for routing",
  "actionType": "string - the PRIMARY action the system should take. One of: create_support_ticket, add_ticket_comment, create_enquiry, create_viewing, process_contractor_response, route_to_pm, ignore",
  "senderType": "string - who sent this email. One of: tenant, landlord, contractor, prospect, unknown",
  "existingTicketReference": "string or null - if the email mentions a ticket number like JB240101ABCD, extract it here. Otherwise null.",

  "tasks": [
    {
      "title": "string - concise task title e.g. 'Respond to rental enquiry from John Smith'",
      "taskType": "string - one of: viewing, call, follow_up, enquiry_response, document, maintenance, general",
      "priority": "string - one of: urgent, high, normal, low",
      "description": "string - brief description of what needs to be done",
      "dueWithinHours": "number - 1 for urgent, 4 for high, 24 for normal, 72 for low"
    }
  ],

  "attachmentClassifications": [
    {
      "filename": "string - exact filename from the attachment list",
      "documentType": "string - one of: passport, driving_licence, proof_of_address, bank_statement, gas_safety, epc, eicr, tenancy_agreement, inventory, invoice, insurance, licence, certificate, photo, reference, other",
      "entityType": "string - who does this document belong to: landlord, tenant, property, tenancy, unknown",
      "confidence": "number 0-1 - how confident you are in this classification",
      "description": "string - brief description of what this document appears to be"
    }
  ],

  "propertyMatch": {
    "address": "string - the property address mentioned in the email (if any)",
    "postcode": "string - UK postcode extracted or inferred",
    "confidence": "number 0-1"
  },

  "leadDetails": {
    "leadType": "string - one of: rental, purchase, both, landlord, seller",
    "budget": "string or null - e.g. '£2,000/month' or '£500,000'",
    "bedrooms": "number or null",
    "areas": ["string - area names or postcodes they're interested in"],
    "moveInDate": "string or null - when they want to move",
    "requirements": "string or null - specific requirements (pets, parking, garden, etc.)"
  }
}

IMPORTANT RULES:

For tasks array:
- ALWAYS include at least one task unless actionType is 'ignore'
- Identify ALL tasks implied by the email, not just the primary action
- If someone sends documents, add a 'Review [document type] from [name]' task
- If someone asks a question, add a 'Respond to [name]' task
- If something needs follow-up, add a 'Follow up with [name]' task

For attachmentClassifications:
- Only include entries if the email has attachments (check the Attachments line)
- Classify based on filename and email context
- KYC documents (passport, driving_licence, proof_of_address, bank_statement) from landlords → entityType: 'landlord'
- KYC documents from tenants → entityType: 'tenant'
- Property certificates (gas_safety, epc, eicr, insurance) → entityType: 'property'
- Photos of damage/repairs → entityType: 'property', documentType: 'photo'
- Invoices from contractors → entityType: 'property', documentType: 'invoice'
- If empty attachments, return empty array []

For propertyMatch:
- Return null if no specific property is mentioned
- Extract the most specific address/postcode you can find
- UK postcodes look like: SW1A 1AA, W1J 7NT, NW8 9SA

For leadDetails:
- Return null unless this is a property enquiry (rental or purchase interest)
- Extract as much qualification data as possible from the email

Rules for actionType:
- If the email reports a problem (leak, broken, noise, pest, heating, electrical, plumbing etc) → create_support_ticket
- If the email references an existing ticket number (JB...) or is a reply to a support conversation → add_ticket_comment
- If someone asks about buying/renting a property → create_enquiry
- If someone wants to view/visit a property → create_viewing
- If a contractor mentions a quote, price, acceptance, availability, or job → process_contractor_response
- If a landlord emails about their property, rent, tenants, or statements → route_to_pm
- If it's spam, an automated bounce/out-of-office, newsletter, or marketing → ignore
- If unsure → route_to_pm${this.getDepartmentInstructions(department)}`;

    const userPrompt = `Analyze this email:

From: ${from}
Subject: ${subject}${attachmentList}

Body:
${emailContent.substring(0, 4000)}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    const parsed = JSON.parse(content) as AiAnalysisResult;

    // Ensure new fields have defaults if AI omitted them
    parsed.tasks = parsed.tasks || [];
    parsed.attachmentClassifications = parsed.attachmentClassifications || [];
    parsed.propertyMatch = parsed.propertyMatch || null;
    parsed.leadDetails = parsed.leadDetails || null;

    return parsed;
  }

  /**
   * Returns department-specific AI routing instructions
   */
  private getDepartmentInstructions(department?: string | null): string {
    if (!department) return '';

    const instructions: Record<string, string> = {
      sales: `

DEPARTMENT CONTEXT: This email was received on the SALES inbox (sales@johnbarclay.uk).
This mailbox handles property purchase and sale enquiries.
Prioritize these actionTypes:
- create_enquiry: for property purchase/sale enquiries, price questions
- create_viewing: for viewing requests on properties for sale
- route_to_pm: for anything needing agent attention (offers, negotiations, solicitor comms)
- ignore: for spam, auto-replies, newsletters
Default senderType assumption: prospect (unless clearly an existing client or solicitor)`,

      lettings: `

DEPARTMENT CONTEXT: This email was received on the LETTINGS inbox (lettings@johnbarclay.uk).
This mailbox handles rental property enquiries and landlord communications.
Prioritize these actionTypes:
- create_enquiry: for rental enquiries, availability questions
- create_viewing: for viewing requests on rental properties
- route_to_pm: for landlord communications, tenancy questions, rent queries
- ignore: for spam, auto-replies, newsletters
Default senderType assumption: prospect (unless clearly a landlord or existing tenant)`,

      maintenance: `

DEPARTMENT CONTEXT: This email was received on the MAINTENANCE inbox (maintenance@johnbarclay.uk).
This mailbox handles property repairs, maintenance requests, and contractor communications.
Prioritize these actionTypes:
- create_support_ticket: for tenant repair/maintenance reports (leaks, heating, electrical, plumbing, pests, structural)
- add_ticket_comment: for follow-ups referencing a ticket number (JB...)
- process_contractor_response: for contractor quotes, availability, job acceptance/decline, invoices
- route_to_pm: for anything else needing human review
- ignore: for spam, auto-replies, newsletters
Default senderType assumption: tenant (unless email matches a known contractor)`,
    };

    return instructions[department] || '';
  }

  /**
   * Updates a processed email with AI analysis results
   */
  private async updateWithAiResults(
    emailId: number,
    results: AiAnalysisResult
  ): Promise<void> {
    await db
      .update(processedEmails)
      .set({
        aiProcessed: true,
        aiProcessedAt: new Date(),
        aiCategory: results.category,
        aiSentiment: results.sentiment,
        aiPriority: results.priority,
        aiSummary: results.summary,
        aiExtractedEntities: results.extractedEntities,
        aiSuggestedActions: results.suggestedActions,
        aiClassification: results.classification,
        // Enhanced workflow fields
        aiExtractedTasks: results.tasks || [],
        aiAttachmentClassifications: results.attachmentClassifications || [],
        aiPropertyMatch: results.propertyMatch || null,
        aiLeadDetails: results.leadDetails || null,
        processingStatus: 'processed',
        updatedAt: new Date(),
      })
      .where(eq(processedEmails.id, emailId));

    console.log(`Updated email ${emailId} with AI analysis (${results.tasks?.length || 0} tasks, ${results.attachmentClassifications?.length || 0} attachment classifications)`);
  }
}

// Export singleton instance
export const emailProcessor = new EmailProcessor();
