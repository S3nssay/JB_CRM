/**
 * Email AI Agent Service
 *
 * Takes action based on AI-analyzed incoming emails.
 * Hooks into the existing email processing pipeline after AI analysis.
 * Creates support tickets, updates existing tickets, creates enquiries,
 * and sends auto-responses.
 */

import { db } from '../../db';
import {
  processedEmails,
  tenant,
  landlords,
  contractors,
  leads,
  supportTickets,
  ticketComments,
  ticketWorkflowEvents,
  customerEnquiries,
  contractorQuotes,
  unifiedContacts,
} from '@shared/schema';
import { eq, and, ilike, desc, sql } from 'drizzle-orm';
import { emailSender } from './emailSender';
import type { AiAnalysisResult } from './emailProcessor';
import { emailAttachmentService } from './emailAttachmentService';
import { taskAssignmentService, TaskContext } from '../taskAssignmentService';
import { propertyMatchingService } from '../propertyMatchingService';
import { leadPipelineService } from '../leadPipelineService';

export interface EmailContext {
  fromAddress: string;
  fromName: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  connectionId: number;
  userId: number;
  graphMessageId: string;
  department?: string | null; // 'sales' | 'lettings' | 'maintenance'
  isImap?: boolean;
  imapAttachments?: { name: string; contentType: string; size: number; content?: Buffer }[];
}

interface ContactMatch {
  type: 'tenant' | 'landlord' | 'contractor' | 'lead' | 'contact' | 'unknown';
  id: number;
  name: string;
  propertyId?: number;
}

class EmailAIAgent {

  async processAction(
    processedEmailId: number,
    aiResults: AiAnalysisResult,
    context: EmailContext
  ): Promise<void> {
    const actionType = aiResults.actionType || 'route_to_pm';
    console.log(`[EmailAIAgent] Processing email ${processedEmailId}: actionType=${actionType}, senderType=${aiResults.senderType}`);

    // Skip no-action types
    if (['ignore', 'spam', 'auto_reply', 'newsletter'].includes(actionType)) {
      await this.recordAction(processedEmailId, 'ignored', { reason: actionType });
      return;
    }

    // Match sender to known contact
    const contact = await this.matchContact(context.fromAddress);
    console.log(`[EmailAIAgent] Matched sender ${context.fromAddress} as ${contact.type} (id=${contact.id})`);

    try {
      switch (actionType) {
        case 'create_support_ticket':
          await this.handleSupportRequest(processedEmailId, aiResults, context, contact);
          break;
        case 'add_ticket_comment':
          await this.handleTicketUpdate(processedEmailId, aiResults, context, contact);
          break;
        case 'create_enquiry':
        case 'create_viewing':
          await this.handlePropertyEnquiry(processedEmailId, aiResults, context, contact);
          break;
        case 'process_contractor_response':
          await this.handleContractorResponse(processedEmailId, aiResults, context, contact);
          break;
        case 'route_to_pm':
          await this.handleRouteToPM(processedEmailId, aiResults, context, contact);
          break;
        default:
          await this.handleRouteToPM(processedEmailId, aiResults, context, contact);
      }

      // ── Cross-cutting: Process attachments for all action types ──
      await this.processAttachmentsIfPresent(processedEmailId, aiResults, context, contact);

      // ── Cross-cutting: Create tasks from AI-extracted task list ──
      await this.createTasksIfPresent(processedEmailId, aiResults, context, contact);

    } catch (error) {
      console.error(`[EmailAIAgent] Action failed for email ${processedEmailId}:`, error);
      await this.recordAction(processedEmailId, 'failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        attemptedAction: actionType,
      });
    }
  }

  // ─── Cross-cutting: Attachment processing ─────────────────────────

  private async processAttachmentsIfPresent(
    processedEmailId: number,
    aiResults: AiAnalysisResult,
    context: EmailContext,
    contact: ContactMatch
  ): Promise<void> {
    try {
      const classifications = aiResults.attachmentClassifications;
      if (!classifications || classifications.length === 0) return;

      const results = await emailAttachmentService.processAttachments(
        processedEmailId,
        classifications,
        contact,
        {
          connectionId: context.connectionId,
          graphMessageId: context.graphMessageId,
          isImap: context.isImap || false,
          imapAttachments: context.imapAttachments,
        }
      );

      if (results.length > 0) {
        console.log(`[EmailAIAgent] Processed ${results.length} attachments for email ${processedEmailId}`);
      }
    } catch (error) {
      console.error(`[EmailAIAgent] Attachment processing failed for email ${processedEmailId}:`, error);
    }
  }

  // ─── Cross-cutting: Task creation from AI analysis ────────────────

  private async createTasksIfPresent(
    processedEmailId: number,
    aiResults: AiAnalysisResult,
    context: EmailContext,
    contact: ContactMatch
  ): Promise<void> {
    try {
      const aiTasks = aiResults.tasks;
      if (!aiTasks || aiTasks.length === 0) return;

      const taskContext: TaskContext = {
        department: context.department || null,
        propertyId: contact.propertyId || null,
        leadId: contact.type === 'lead' ? contact.id : null,
        landlordId: contact.type === 'landlord' ? contact.id : null,
        tenantId: contact.type === 'tenant' ? contact.id : null,
        ticketId: null,
        sourceEmailId: processedEmailId,
      };

      const createdTasks = await taskAssignmentService.createTasksFromEmail(
        aiTasks,
        taskContext,
        context.userId
      );

      if (createdTasks.length > 0) {
        console.log(`[EmailAIAgent] Created ${createdTasks.length} tasks from email ${processedEmailId}`);
      }
    } catch (error) {
      console.error(`[EmailAIAgent] Task creation failed for email ${processedEmailId}:`, error);
    }
  }

  // ─── Contact matching ──────────────────────────────────────────────

  private async matchContact(email: string): Promise<ContactMatch> {
    const normalized = email.toLowerCase().trim();

    // Run all lookups in parallel — priority order is applied after
    const [tenantResults, landlordResults, contractorResults, leadResults, contactResults] = await Promise.all([
      db.select().from(tenant).where(ilike(tenant.email, normalized)).limit(1),
      db.select().from(landlords).where(ilike(landlords.email, normalized)).limit(1),
      db.select().from(contractors).where(ilike(contractors.email, normalized)).limit(1),
      db.select().from(leads).where(ilike(leads.email, normalized)).limit(1),
      db.select().from(unifiedContacts).where(ilike(unifiedContacts.email, normalized)).limit(1),
    ]);

    // Return first match in priority order: tenant > landlord > contractor > lead > contact
    if (tenantResults[0]) {
      return { type: 'tenant', id: tenantResults[0].id, name: tenantResults[0].name || email, propertyId: tenantResults[0].propertyId ?? undefined };
    }
    if (landlordResults[0]) {
      return { type: 'landlord', id: landlordResults[0].id, name: landlordResults[0].name || email };
    }
    if (contractorResults[0]) {
      return { type: 'contractor', id: contractorResults[0].id, name: contractorResults[0].contactName || contractorResults[0].companyName || email };
    }
    if (leadResults[0]) {
      return { type: 'lead', id: leadResults[0].id, name: leadResults[0].fullName || email };
    }
    if (contactResults[0]) {
      return { type: 'contact', id: contactResults[0].id, name: contactResults[0].fullName || email };
    }

    return { type: 'unknown', id: 0, name: email };
  }

  // ─── Support ticket creation ───────────────────────────────────────

  private async handleSupportRequest(
    processedEmailId: number,
    aiResults: AiAnalysisResult,
    context: EmailContext,
    contact: ContactMatch
  ): Promise<void> {
    // If sender is not a known tenant with a property, route to PM
    if (contact.type !== 'tenant' || !contact.propertyId) {
      console.log(`[EmailAIAgent] Sender not a tenant with property, routing to PM`);
      await this.handleRouteToPM(processedEmailId, aiResults, context, contact);
      return;
    }

    // Generate ticket number (same format as tenantSupportService)
    const date = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    const ticketNumber = `JB${date}${random}`;

    const ticketCategory = this.mapToTicketCategory(aiResults.category);
    const isEmergency = aiResults.priority === 'urgent';

    // Create support ticket
    const [ticket] = await db.insert(supportTickets).values({
      tenantId: contact.id,
      propertyId: contact.propertyId,
      ticketNumber,
      category: ticketCategory,
      subject: aiResults.summary || context.subject,
      description: context.bodyText || context.bodyHtml || context.subject,
      priority: aiResults.priority === 'urgent' ? 'urgent' : aiResults.priority === 'high' ? 'high' : 'medium',
      status: isEmergency ? 'open' : 'open',
      attachments: [],
    }).returning();

    // Record workflow event
    await db.insert(ticketWorkflowEvents).values({
      ticketId: ticket.id,
      eventType: 'ticket_created',
      previousStatus: null,
      newStatus: 'new',
      triggeredBy: 'system',
      title: 'Support ticket created from email',
      description: `Email from ${context.fromAddress}: ${aiResults.summary || context.subject}`,
      notificationSent: true,
      notificationChannels: ['email'],
      metadata: { source: 'email_ai_agent', processedEmailId },
    });

    // Link processed email to ticket
    await db.update(processedEmails)
      .set({ linkedTicketId: ticket.id })
      .where(eq(processedEmails.id, processedEmailId));

    await this.recordAction(processedEmailId, 'support_ticket_created', {
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      category: ticketCategory,
      priority: ticket.priority,
    });

    // Send acknowledgement email
    await this.sendAcknowledgement(context, {
      type: 'support_ticket',
      ticketNumber: ticket.ticketNumber!,
      contactName: contact.name,
      subject: ticket.subject || context.subject,
      priority: ticket.priority || 'medium',
    });

    // Notify property manager
    await this.notifyPM(context, aiResults, contact, {
      type: 'new_support_ticket',
      ticketNumber: ticket.ticketNumber!,
      ticketId: ticket.id,
      category: ticketCategory,
      priority: ticket.priority || 'medium',
    });

    // Emergency: send SMS notification for urgent maintenance via Twilio if available
    if (isEmergency) {
      await this.sendEmergencyNotification(context, ticket.ticketNumber!, contact.name, aiResults.summary || context.subject);
    }

    console.log(`[EmailAIAgent] Created support ticket ${ticketNumber} for tenant ${contact.name}`);
  }

  /**
   * Send SMS/WhatsApp notification for urgent maintenance issues
   */
  private async sendEmergencyNotification(
    context: EmailContext,
    ticketNumber: string,
    tenantName: string,
    summary: string
  ): Promise<void> {
    try {
      const pmPhone = process.env.EMERGENCY_PM_PHONE;
      if (!pmPhone) {
        console.log('[EmailAIAgent] No EMERGENCY_PM_PHONE configured, skipping SMS notification');
        return;
      }

      // Use Twilio if configured
      const twilioSid = process.env.TWILIO_ACCOUNT_SID;
      const twilioToken = process.env.TWILIO_AUTH_TOKEN;
      const twilioFrom = process.env.TWILIO_PHONE_NUMBER;

      if (!twilioSid || !twilioToken || !twilioFrom) {
        console.log('[EmailAIAgent] Twilio not configured, skipping SMS notification');
        return;
      }

      const twilio = require('twilio');
      const client = twilio(twilioSid, twilioToken);

      const message = `URGENT MAINTENANCE - Ticket #${ticketNumber}\nTenant: ${tenantName}\n${summary}\n\nRequires immediate attention.`;

      await client.messages.create({
        body: message,
        from: twilioFrom,
        to: pmPhone,
      });

      console.log(`[EmailAIAgent] Emergency SMS sent for ticket ${ticketNumber}`);
    } catch (error) {
      console.error('[EmailAIAgent] Failed to send emergency SMS:', error);
    }
  }

  // ─── Ticket update (follow-up email) ──────────────────────────────

  private async handleTicketUpdate(
    processedEmailId: number,
    aiResults: AiAnalysisResult,
    context: EmailContext,
    contact: ContactMatch
  ): Promise<void> {
    let ticket = null;

    // 1. Check if AI extracted a ticket reference
    if (aiResults.existingTicketReference) {
      const [found] = await db.select().from(supportTickets)
        .where(eq(supportTickets.ticketNumber, aiResults.existingTicketReference))
        .limit(1);
      ticket = found || null;
    }

    // 2. If no explicit reference, find latest open ticket for this tenant
    if (!ticket && contact.type === 'tenant') {
      const [latestTicket] = await db.select().from(supportTickets)
        .where(and(
          eq(supportTickets.tenantId, contact.id),
          sql`${supportTickets.status} NOT IN ('closed', 'resolved')`
        ))
        .orderBy(desc(supportTickets.createdAt))
        .limit(1);
      ticket = latestTicket || null;
    }

    // 3. If no ticket found, create a new one
    if (!ticket) {
      return this.handleSupportRequest(processedEmailId, aiResults, context, contact);
    }

    // Add comment to existing ticket
    await db.insert(ticketComments).values({
      ticketId: ticket.id,
      comment: `[Email from ${context.fromAddress}]\n\nSubject: ${context.subject}\n\n${context.bodyText || 'See HTML content'}`,
      isInternal: false,
      attachments: [],
    });

    // Update ticket timestamp
    await db.update(supportTickets)
      .set({ updatedAt: new Date() })
      .where(eq(supportTickets.id, ticket.id));

    // Record workflow event
    await db.insert(ticketWorkflowEvents).values({
      ticketId: ticket.id,
      eventType: 'comment_added',
      triggeredBy: 'system',
      title: 'Follow-up email received from tenant',
      description: aiResults.summary || context.subject,
      metadata: { source: 'email_ai_agent', processedEmailId },
    });

    await this.recordAction(processedEmailId, 'ticket_comment_added', {
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
    });

    // Link email to ticket
    await db.update(processedEmails)
      .set({ linkedTicketId: ticket.id })
      .where(eq(processedEmails.id, processedEmailId));

    // Send acknowledgement
    await this.sendAcknowledgement(context, {
      type: 'ticket_update',
      ticketNumber: ticket.ticketNumber!,
      contactName: contact.name,
      subject: context.subject,
      priority: ticket.priority || 'medium',
    });

    console.log(`[EmailAIAgent] Added comment to ticket ${ticket.ticketNumber} from email ${processedEmailId}`);
  }

  // ─── Property enquiry → Lead pipeline ────────────────────────────

  private async handlePropertyEnquiry(
    processedEmailId: number,
    aiResults: AiAnalysisResult,
    context: EmailContext,
    contact: ContactMatch
  ): Promise<void> {
    // 1. Match email to a property record
    const propertyMatch = await propertyMatchingService.matchFromEmail(aiResults, context.department);
    const matchedPropertyId = propertyMatch?.propertyId || null;

    if (propertyMatch) {
      console.log(`[EmailAIAgent] Matched to property ${propertyMatch.propertyId} (${propertyMatch.matchType}, confidence=${propertyMatch.confidence})`);
    }

    // 2. Create or update lead in the pipeline (replaces dead-end customerEnquiry)
    const leadResult = await leadPipelineService.createOrUpdateLeadFromEmail(
      {
        fromAddress: context.fromAddress,
        fromName: context.fromName || contact.name,
        subject: context.subject,
        bodyText: context.bodyText || context.subject,
        department: context.department || null,
        processedEmailId,
      },
      aiResults,
      matchedPropertyId
    );

    // 3. Link email to lead
    await db.update(processedEmails)
      .set({ linkedLeadId: leadResult.leadId })
      .where(eq(processedEmails.id, processedEmailId));

    // 4. Also create a legacy customerEnquiry for backward compatibility
    const enquiryType = aiResults.category === 'viewing_request' ? 'viewing' :
                        aiResults.category === 'valuation_request' ? 'valuation' : 'general';

    const [enquiry] = await db.insert(customerEnquiries).values({
      source: 'email',
      sourceDetails: `AI Agent - ${aiResults.summary || context.subject}`,
      customerName: contact.name || context.fromName || context.fromAddress,
      customerEmail: context.fromAddress,
      customerPhone: aiResults.extractedEntities?.phones?.[0] || '',
      enquiryType,
      message: context.bodyText || context.subject,
      status: 'new',
      leadScore: aiResults.priority === 'urgent' ? 80 : aiResults.priority === 'high' ? 70 : 50,
      leadTemperature: aiResults.priority === 'high' ? 'hot' : 'warm',
    }).returning();

    await db.update(processedEmails)
      .set({ linkedEnquiryId: enquiry.id })
      .where(eq(processedEmails.id, processedEmailId));

    await this.recordAction(processedEmailId, 'lead_created', {
      leadId: leadResult.leadId,
      isNewLead: leadResult.isNew,
      enquiryId: enquiry.id,
      enquiryType,
      matchedPropertyId,
      matchConfidence: propertyMatch?.confidence || null,
    });

    // 5. Send acknowledgement
    await this.sendAcknowledgement(context, {
      type: 'enquiry',
      ticketNumber: `ENQ-${enquiry.id}`,
      contactName: contact.name || context.fromName || 'there',
      subject: context.subject,
      priority: 'normal',
    });

    console.log(`[EmailAIAgent] Created lead ${leadResult.leadId} (new=${leadResult.isNew}) + enquiry ${enquiry.id} from email ${processedEmailId}, property match: ${matchedPropertyId || 'none'}`);
  }

  // ─── Contractor response ──────────────────────────────────────────

  private async handleContractorResponse(
    processedEmailId: number,
    aiResults: AiAnalysisResult,
    context: EmailContext,
    contact: ContactMatch
  ): Promise<void> {
    if (contact.type !== 'contractor') {
      await this.handleRouteToPM(processedEmailId, aiResults, context, contact);
      return;
    }

    // Find pending quote for this contractor
    const [pendingQuote] = await db.select().from(contractorQuotes)
      .where(and(
        eq(contractorQuotes.contractorId, contact.id),
        eq(contractorQuotes.status, 'pending')
      ))
      .orderBy(desc(contractorQuotes.createdAt))
      .limit(1);

    if (!pendingQuote) {
      await this.handleRouteToPM(processedEmailId, aiResults, context, contact);
      return;
    }

    // Parse response
    const bodyLower = (context.bodyText || '').toLowerCase();
    const amounts = aiResults.extractedEntities?.amounts;
    const parsedAmount = amounts?.[0] ? this.parseAmount(amounts[0]) : null;

    let newStatus: string;
    if (bodyLower.includes('decline') || bodyLower.includes('cannot') || bodyLower.includes('unable') || bodyLower.includes('unavailable')) {
      newStatus = 'declined';
    } else if (parsedAmount) {
      newStatus = 'quoted';
    } else {
      newStatus = 'accepted';
    }

    // Update quote
    const updateValues: Record<string, any> = {
      status: newStatus,
      contractorNotes: context.bodyText,
      respondedAt: new Date(),
    };
    if (parsedAmount && newStatus === 'quoted') {
      updateValues.quoteAmount = parsedAmount;
    }

    await db.update(contractorQuotes)
      .set(updateValues)
      .where(eq(contractorQuotes.id, pendingQuote.id));

    // Record workflow event
    const eventType = newStatus === 'quoted' ? 'quote_received' :
                      newStatus === 'accepted' ? 'contractor_accepted' : 'contractor_declined';

    await db.insert(ticketWorkflowEvents).values({
      ticketId: pendingQuote.ticketId,
      eventType,
      triggeredBy: 'contractor',
      title: `Contractor ${contact.name} ${newStatus} via email`,
      description: context.bodyText?.substring(0, 300) || context.subject,
      metadata: { source: 'email_ai_agent', processedEmailId, amount: parsedAmount },
    });

    await this.recordAction(processedEmailId, 'contractor_response_processed', {
      quoteId: pendingQuote.id,
      ticketId: pendingQuote.ticketId,
      responseType: newStatus,
      amount: parsedAmount,
    });

    // Notify PM
    await this.notifyPM(context, aiResults, contact, {
      type: 'contractor_response',
      responseType: newStatus,
      amount: parsedAmount,
      contractorName: contact.name,
    });

    // Create follow-up task for PM to review contractor response
    const taskTitle = newStatus === 'quoted'
      ? `Review quote from ${contact.name} - £${parsedAmount ? (parsedAmount / 100).toFixed(2) : 'TBC'}`
      : `Contractor ${contact.name} ${newStatus} - review required`;

    await taskAssignmentService.createTask(
      taskTitle,
      'contractor_review',
      newStatus === 'declined' ? 'high' : 'normal',
      `Contractor ${contact.name} has ${newStatus} the job. Email: ${context.subject}`,
      {
        department: 'maintenance',
        propertyId: null, // Could look up from ticket
        leadId: null,
        landlordId: null,
        tenantId: null,
        ticketId: pendingQuote.ticketId,
        sourceEmailId: processedEmailId,
      }
    );

    console.log(`[EmailAIAgent] Processed contractor response: ${newStatus} for quote ${pendingQuote.id}`);
  }

  // ─── Route to property manager ────────────────────────────────────

  private async handleRouteToPM(
    processedEmailId: number,
    aiResults: AiAnalysisResult,
    context: EmailContext,
    contact: ContactMatch
  ): Promise<void> {
    await this.notifyPM(context, aiResults, contact, {
      type: 'forwarded',
      reason: `${aiResults.category} from ${contact.type}`,
    });

    // Create a task to ensure this email is reviewed — nothing falls through the cracks
    await taskAssignmentService.createTask(
      `Review email: ${(aiResults.summary || context.subject).substring(0, 80)}`,
      'email_review',
      aiResults.priority === 'urgent' ? 'high' : 'normal',
      `Email from ${contact.name} (${context.fromAddress}) routed for review.\nCategory: ${aiResults.category}\nSummary: ${aiResults.summary || context.subject}`,
      {
        department: context.department || null,
        propertyId: contact.propertyId || null,
        leadId: contact.type === 'lead' ? contact.id : null,
        landlordId: contact.type === 'landlord' ? contact.id : null,
        tenantId: contact.type === 'tenant' ? contact.id : null,
        ticketId: null,
        sourceEmailId: processedEmailId,
      }
    );

    await this.recordAction(processedEmailId, 'routed_to_pm', {
      reason: aiResults.category,
      contactType: contact.type,
      contactId: contact.id > 0 ? contact.id : null,
    });

    console.log(`[EmailAIAgent] Routed email ${processedEmailId} to PM (${aiResults.category})`);
  }

  // ─── Auto-reply emails ────────────────────────────────────────────

  private async sendAcknowledgement(
    context: EmailContext,
    details: { type: string; ticketNumber: string; contactName: string; subject: string; priority: string }
  ): Promise<void> {
    try {
      const deptName = this.getDepartmentName(context.department);
      let bodyHtml: string;

      if (details.type === 'support_ticket') {
        bodyHtml = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #791E75; color: white; padding: 20px; text-align: center;">
    <h2 style="margin: 0;">${deptName}</h2>
  </div>
  <div style="padding: 20px; line-height: 1.6;">
    <p>Dear ${details.contactName},</p>
    <p>Thank you for contacting us. We have received your request and created a support ticket.</p>
    <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
      <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Ticket Reference</td><td style="padding: 8px; border-bottom: 1px solid #eee;">#${details.ticketNumber}</td></tr>
      <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Subject</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${details.subject}</td></tr>
      <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Priority</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${details.priority}</td></tr>
    </table>
    <p>Our property management team will review your request and get back to you shortly.</p>
    <p>You can reply to this email to add more information to your ticket. Please keep the ticket reference in the subject line.</p>
    <p>If this is an emergency, please call our office directly at <strong>020 7328 8888</strong>.</p>
    <br>
    <p>Best regards,<br>${deptName}</p>
  </div>
</div>`;
      } else if (details.type === 'ticket_update') {
        bodyHtml = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #791E75; color: white; padding: 20px; text-align: center;">
    <h2 style="margin: 0;">${deptName}</h2>
  </div>
  <div style="padding: 20px; line-height: 1.6;">
    <p>Dear ${details.contactName},</p>
    <p>Thank you for your message. Your update has been added to ticket <strong>#${details.ticketNumber}</strong>.</p>
    <p>Our team will review and respond as soon as possible.</p>
    <br>
    <p>Best regards,<br>${deptName}</p>
  </div>
</div>`;
      } else {
        bodyHtml = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #791E75; color: white; padding: 20px; text-align: center;">
    <h2 style="margin: 0;">${deptName}</h2>
  </div>
  <div style="padding: 20px; line-height: 1.6;">
    <p>Dear ${details.contactName},</p>
    <p>Thank you for your enquiry. We have received your message and one of our agents will be in touch shortly.</p>
    <p>Reference: <strong>${details.ticketNumber}</strong></p>
    <br>
    <p>Best regards,<br>${deptName}</p>
  </div>
</div>`;
      }

      const subjectPrefix = details.type === 'support_ticket' ? `[Ticket #${details.ticketNumber}] ` :
                            details.type === 'ticket_update' ? `Re: [Ticket #${details.ticketNumber}] ` : '';

      await emailSender.queueEmail({
        connectionId: context.connectionId,
        userId: context.userId,
        to: [context.fromAddress],
        subject: `${subjectPrefix}${context.subject}`,
        bodyHtml,
      });
    } catch (error) {
      console.error('[EmailAIAgent] Failed to send acknowledgement:', error);
    }
  }

  // ─── PM notification ──────────────────────────────────────────────

  private getDepartmentEmail(department?: string | null): string {
    switch (department) {
      case 'sales': return process.env.SALES_MANAGER_EMAIL || 'sales@johnbarclay.uk';
      case 'lettings': return process.env.LETTINGS_MANAGER_EMAIL || 'lettings@johnbarclay.uk';
      case 'maintenance': return process.env.MAINTENANCE_MANAGER_EMAIL || 'maintenance@johnbarclay.uk';
      default: return process.env.PROPERTY_MANAGER_EMAIL || 'property@johnbarclay.uk';
    }
  }

  private getDepartmentName(department?: string | null): string {
    switch (department) {
      case 'sales': return 'John Barclay Sales';
      case 'lettings': return 'John Barclay Lettings';
      case 'maintenance': return 'John Barclay Property Management';
      default: return 'John Barclay Estate Agents';
    }
  }

  private async notifyPM(
    context: EmailContext,
    aiResults: AiAnalysisResult,
    contact: ContactMatch,
    details: Record<string, any>
  ): Promise<void> {
    try {
      const pmEmail = this.getDepartmentEmail(context.department);

      let notificationSubject: string;
      let notificationBody: string;

      if (details.type === 'new_support_ticket') {
        notificationSubject = `[New Ticket #${details.ticketNumber}] ${aiResults.summary || context.subject}`;
        notificationBody = `
<div style="font-family: Arial, sans-serif; max-width: 600px;">
  <h3 style="color: #791E75;">New Support Ticket Created by AI Agent</h3>
  <table style="width: 100%; border-collapse: collapse;">
    <tr><td style="padding: 6px; font-weight: bold;">Ticket</td><td style="padding: 6px;">#${details.ticketNumber}</td></tr>
    <tr><td style="padding: 6px; font-weight: bold;">From</td><td style="padding: 6px;">${contact.name} (${context.fromAddress})</td></tr>
    <tr><td style="padding: 6px; font-weight: bold;">Category</td><td style="padding: 6px;">${details.category}</td></tr>
    <tr><td style="padding: 6px; font-weight: bold;">Priority</td><td style="padding: 6px;">${details.priority}</td></tr>
    <tr><td style="padding: 6px; font-weight: bold;">AI Summary</td><td style="padding: 6px;">${aiResults.summary}</td></tr>
  </table>
  <h4>Original Email:</h4>
  <blockquote style="border-left: 3px solid #ccc; padding-left: 12px; color: #555;">
    <p><strong>Subject:</strong> ${context.subject}</p>
    <p>${(context.bodyText || '').substring(0, 500)}</p>
  </blockquote>
</div>`;
      } else if (details.type === 'contractor_response') {
        notificationSubject = `[Contractor Response] ${details.contractorName} ${details.responseType}${details.amount ? ' - ' + details.amount + 'p' : ''}`;
        notificationBody = `
<div style="font-family: Arial, sans-serif;">
  <h3 style="color: #791E75;">Contractor Response Received via Email</h3>
  <p><strong>Contractor:</strong> ${details.contractorName}</p>
  <p><strong>Response:</strong> ${details.responseType}</p>
  ${details.amount ? `<p><strong>Quote Amount:</strong> £${(details.amount / 100).toFixed(2)}</p>` : ''}
  <h4>Email Content:</h4>
  <blockquote style="border-left: 3px solid #ccc; padding-left: 12px; color: #555;">
    ${(context.bodyText || '').substring(0, 500)}
  </blockquote>
</div>`;
      } else {
        notificationSubject = `[AI Agent Forward] ${context.subject}`;
        notificationBody = `
<div style="font-family: Arial, sans-serif;">
  <h3 style="color: #791E75;">Email Forwarded by AI Agent</h3>
  <p><strong>From:</strong> ${contact.name} (${context.fromAddress}) - ${contact.type}</p>
  <p><strong>Category:</strong> ${aiResults.category}</p>
  <p><strong>AI Summary:</strong> ${aiResults.summary}</p>
  <p><strong>Reason:</strong> ${details.reason || 'Requires human review'}</p>
  <h4>Original Email:</h4>
  <blockquote style="border-left: 3px solid #ccc; padding-left: 12px; color: #555;">
    <p><strong>Subject:</strong> ${context.subject}</p>
    <p>${(context.bodyText || '').substring(0, 500)}</p>
  </blockquote>
</div>`;
      }

      await emailSender.queueEmail({
        connectionId: context.connectionId,
        userId: context.userId,
        to: [pmEmail],
        subject: notificationSubject,
        bodyHtml: notificationBody,
      });
    } catch (error) {
      console.error('[EmailAIAgent] Failed to notify PM:', error);
    }
  }

  // ─── Recording ────────────────────────────────────────────────────

  private async recordAction(
    processedEmailId: number,
    actionType: string,
    details: Record<string, any>
  ): Promise<void> {
    await db.update(processedEmails)
      .set({
        aiAgentActionType: actionType,
        aiAgentActionDetails: details,
        aiAgentProcessedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(processedEmails.id, processedEmailId));
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  private mapToTicketCategory(aiCategory: string): string {
    const mapping: Record<string, string> = {
      maintenance: 'general',
      support_request: 'general',
      tenant_communication: 'general',
    };
    // Check if the AI summary/category contains specific keywords
    return mapping[aiCategory] || 'general';
  }

  private parseAmount(amountStr: string): number | null {
    const cleaned = amountStr.replace(/[^0-9.]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : Math.round(parsed * 100); // Store in pence
  }
}

export const emailAIAgent = new EmailAIAgent();
