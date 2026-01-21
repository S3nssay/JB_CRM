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

    // Try to find existing conversation by email address
    const existingConversations = await db
      .select()
      .from(conversations)
      .where(
        or(
          ilike(conversations.contactEmail, email.fromAddress),
          ilike(conversations.contactPhone, email.fromAddress)
        )
      )
      .limit(1);

    if (existingConversations.length > 0) {
      result.conversationId = existingConversations[0].id;
      await db
        .update(processedEmails)
        .set({ linkedConversationId: result.conversationId })
        .where(eq(processedEmails.id, email.id));
    }

    // Try to find existing lead/enquiry
    const existingEnquiries = await db
      .select()
      .from(customerEnquiries)
      .where(ilike(customerEnquiries.email, email.fromAddress))
      .limit(1);

    if (existingEnquiries.length > 0) {
      result.contactId = existingEnquiries[0].id;
      await db
        .update(processedEmails)
        .set({ linkedEnquiryId: existingEnquiries[0].id })
        .where(eq(processedEmails.id, email.id));
    }

    // Try to find in leads table
    const existingLeads = await db
      .select()
      .from(leads)
      .where(ilike(leads.email, email.fromAddress))
      .limit(1);

    if (existingLeads.length > 0) {
      result.contactId = existingLeads[0].id;
      await db
        .update(processedEmails)
        .set({ linkedContactId: existingLeads[0].id })
        .where(eq(processedEmails.id, email.id));
    }

    return result;
  }

  /**
   * Performs AI analysis on the email content
   */
  private async performAiAnalysis(message: GraphMessage): Promise<AiAnalysisResult> {
    if (!openai) {
      throw new Error('OpenAI not configured');
    }

    const emailContent = message.body?.content || message.bodyPreview || '';
    const subject = message.subject || '';
    const from = message.from?.emailAddress?.address || '';

    const systemPrompt = `You are an AI assistant for a real estate CRM (Customer Relationship Management) system for John Barclay Estate Agents in London, UK.
Analyze incoming emails and extract structured information.

The business handles:
- Property sales and rentals
- Property valuations
- Viewings and appointments
- Landlord and tenant relations
- Property management
- Maintenance requests

Respond with a JSON object containing:
{
  "category": "string - one of: property_enquiry, viewing_request, valuation_request, maintenance, tenant_communication, landlord_communication, offer, contract, general_enquiry, spam, other",
  "sentiment": "string - one of: positive, neutral, negative",
  "priority": "string - one of: urgent, high, normal, low",
  "summary": "string - 1-2 sentence summary of the email",
  "extractedEntities": {
    "names": ["array of person names mentioned"],
    "emails": ["array of email addresses mentioned"],
    "phones": ["array of phone numbers mentioned"],
    "addresses": ["array of property addresses mentioned"],
    "dates": ["array of dates mentioned"],
    "amounts": ["array of monetary amounts mentioned"],
    "propertyReferences": ["array of property IDs or references mentioned"]
  },
  "suggestedActions": [
    {
      "action": "string - suggested action to take",
      "confidence": "number 0-1",
      "details": "string - optional additional details"
    }
  ],
  "classification": "string - business classification for routing"
}`;

    const userPrompt = `Analyze this email:

From: ${from}
Subject: ${subject}

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
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    return JSON.parse(content) as AiAnalysisResult;
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
        processingStatus: 'processed',
        updatedAt: new Date(),
      })
      .where(eq(processedEmails.id, emailId));

    console.log(`Updated email ${emailId} with AI analysis`);
  }
}

// Export singleton instance
export const emailProcessor = new EmailProcessor();
