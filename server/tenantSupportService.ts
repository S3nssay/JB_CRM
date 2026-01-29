import twilio from 'twilio';
import { db } from './db';
import {
  supportTickets,
  ticketComments,
  contractors,
  contractorQuotes,
  ticketWorkflowEvents,
  users,
  properties,
  tenant,
  messages,
  conversations
} from '@shared/schema';
import { eq, and, desc, sql, inArray, like } from 'drizzle-orm';
import { emailService } from './emailService';
import { openaiClient, isOpenAIConfigured } from './lib/openaiClient';

// Initialize clients
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

const openai = openaiClient;

const fromWhatsApp = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

// Ticket categories and their routing rules
const TICKET_CATEGORIES = {
  plumbing: {
    name: 'Plumbing',
    keywords: ['leak', 'water', 'tap', 'toilet', 'drain', 'pipe', 'blocked', 'flooding', 'boiler', 'hot water', 'shower', 'bath'],
    urgencyKeywords: ['flooding', 'burst', 'no water', 'sewage'],
    contractorSpecialization: 'plumbing',
    defaultPriority: 'medium'
  },
  electrical: {
    name: 'Electrical',
    keywords: ['electric', 'power', 'socket', 'light', 'switch', 'fuse', 'circuit', 'sparking', 'no power', 'outlet'],
    urgencyKeywords: ['sparking', 'burning smell', 'no power', 'shock'],
    contractorSpecialization: 'electrical',
    defaultPriority: 'high'
  },
  heating: {
    name: 'Heating & Gas',
    keywords: ['heating', 'radiator', 'gas', 'boiler', 'thermostat', 'cold', 'warm', 'central heating'],
    urgencyKeywords: ['gas smell', 'gas leak', 'no heating', 'carbon monoxide'],
    contractorSpecialization: 'gas',
    defaultPriority: 'high'
  },
  appliances: {
    name: 'Appliances',
    keywords: ['washing machine', 'dishwasher', 'oven', 'cooker', 'fridge', 'freezer', 'dryer', 'appliance'],
    urgencyKeywords: [],
    contractorSpecialization: 'appliances',
    defaultPriority: 'low'
  },
  structural: {
    name: 'Structural',
    keywords: ['roof', 'ceiling', 'wall', 'floor', 'damp', 'mould', 'mold', 'crack', 'door', 'window', 'lock'],
    urgencyKeywords: ['roof leak', 'ceiling collapse', 'break-in', 'door broken', 'window broken', 'cant lock'],
    contractorSpecialization: 'general',
    defaultPriority: 'medium'
  },
  pest: {
    name: 'Pest Control',
    keywords: ['pest', 'mice', 'rat', 'cockroach', 'bed bug', 'ant', 'wasp', 'bee', 'insect', 'rodent'],
    urgencyKeywords: ['infestation'],
    contractorSpecialization: 'pest_control',
    defaultPriority: 'high'
  },
  exterior: {
    name: 'Exterior & Garden',
    keywords: ['garden', 'fence', 'gate', 'driveway', 'gutter', 'external', 'outside', 'parking'],
    urgencyKeywords: [],
    contractorSpecialization: 'general',
    defaultPriority: 'low'
  },
  billing: {
    name: 'Billing & Rent',
    keywords: ['rent', 'payment', 'invoice', 'charge', 'deposit', 'bill', 'fee', 'money'],
    urgencyKeywords: [],
    contractorSpecialization: null,
    defaultPriority: 'medium'
  },
  general: {
    name: 'General Inquiry',
    keywords: [],
    urgencyKeywords: [],
    contractorSpecialization: null,
    defaultPriority: 'low'
  }
};

// Support manager routing based on category
const SUPPORT_MANAGERS = {
  maintenance: ['property_manager', 'maintenance_supervisor'],
  billing: ['accounts_manager', 'property_manager'],
  emergency: ['emergency_contact', 'property_manager', 'on_call_manager'],
  general: ['property_manager', 'admin']
};

interface IncomingWhatsAppMessage {
  From: string;
  To: string;
  Body: string;
  MessageSid: string;
  NumMedia?: string;
  MediaUrl0?: string;
  MediaUrl1?: string;
  MediaUrl2?: string;
  MediaContentType0?: string;
  MediaContentType1?: string;
  MediaContentType2?: string;
}

interface TicketClassification {
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  isEmergency: boolean;
  suggestedContractorType: string | null;
  confidence: number;
  summary: string;
  suggestedResponse: string;
}

interface CommunicationRecord {
  id: number;
  channel: 'whatsapp' | 'email' | 'phone' | 'sms';
  direction: 'inbound' | 'outbound';
  content: string;
  timestamp: Date;
  ticketId?: number;
  userId?: number;
  attachments?: string[];
}

/**
 * Tenant Support Service
 * Handles WhatsApp-based AI-powered support with full 360-degree communication tracking
 */
export class TenantSupportService {
  private conversationStates: Map<string, {
    tenantId: number;
    propertyId: number;
    currentTicketId: number | null;
    lastMessageTime: Date;
    conversationContext: string[];
  }> = new Map();

  constructor() {
    console.log('[TenantSupport] Service initialized');
  }

  /**
   * Process incoming WhatsApp message from tenant
   */
  async processIncomingWhatsApp(message: IncomingWhatsAppMessage): Promise<string> {
    const phoneNumber = this.normalizePhoneNumber(message.From.replace('whatsapp:', ''));

    console.log(`[TenantSupport] Incoming WhatsApp from ${phoneNumber}: ${message.Body}`);

    try {
      // Find tenant by phone number
      const tenant = await this.findTenantByPhone(phoneNumber);

      if (!tenant) {
        return this.generateUnknownTenantResponse(phoneNumber);
      }

      // Get or create conversation state
      let state = this.conversationStates.get(phoneNumber);
      if (!state || this.isConversationStale(state.lastMessageTime)) {
        state = {
          tenantId: tenant.id,
          propertyId: tenant.propertyId,
          currentTicketId: null,
          lastMessageTime: new Date(),
          conversationContext: []
        };
        this.conversationStates.set(phoneNumber, state);
      }

      // Update last message time
      state.lastMessageTime = new Date();
      state.conversationContext.push(`Tenant: ${message.Body}`);

      // Collect media attachments
      const attachments = this.extractMediaUrls(message);

      // Record communication
      await this.recordCommunication({
        channel: 'whatsapp',
        direction: 'inbound',
        phoneNumber,
        content: message.Body,
        attachments,
        tenantId: tenant.id,
        ticketId: state.currentTicketId || undefined
      });

      // Check if tenant is responding to an existing ticket
      if (state.currentTicketId) {
        return await this.handleTicketResponse(state, message.Body, attachments, tenant);
      }

      // Check for common commands
      const command = this.parseCommand(message.Body);
      if (command) {
        return await this.handleCommand(command, tenant, state);
      }

      // Classify the message and create/update ticket
      const classification = await this.classifyMessage(message.Body, attachments);

      // Create new support ticket
      const ticket = await this.createSupportTicket({
        tenantId: tenant.id,
        propertyId: tenant.propertyId,
        category: classification.category,
        subject: classification.summary,
        description: message.Body,
        priority: classification.priority,
        attachments,
        isEmergency: classification.isEmergency,
        classification
      });

      state.currentTicketId = ticket.id;

      // Route to appropriate support manager
      await this.routeTicket(ticket, classification);

      // Generate and send response
      const response = await this.generateAIResponse(
        tenant,
        message.Body,
        classification,
        ticket.ticketNumber
      );

      state.conversationContext.push(`Agent: ${response}`);

      // Record outbound communication
      await this.recordCommunication({
        channel: 'whatsapp',
        direction: 'outbound',
        phoneNumber,
        content: response,
        tenantId: tenant.id,
        ticketId: ticket.id
      });

      return response;

    } catch (error) {
      console.error('[TenantSupport] Error processing WhatsApp:', error);
      return "I apologize, but I'm experiencing technical difficulties. Please try again or call our office directly at 020 7123 4567.";
    }
  }

  /**
   * Process incoming WhatsApp message from contractor (job acceptance/quote)
   */
  async processContractorWhatsApp(message: IncomingWhatsAppMessage): Promise<string> {
    const phoneNumber = this.normalizePhoneNumber(message.From.replace('whatsapp:', ''));
    const messageBody = message.Body.trim();

    console.log(`[TenantSupport] Incoming WhatsApp from contractor ${phoneNumber}: ${messageBody}`);

    try {
      // Find contractor by phone number
      const contractor = await this.findContractorByPhone(phoneNumber);

      if (!contractor) {
        console.log(`[TenantSupport] Unknown contractor phone: ${phoneNumber}`);
        return "Thank you for your message. We couldn't match your phone number to a registered contractor. Please contact our office at 020 7123 4567.";
      }

      // Find pending quotes for this contractor
      const pendingQuotes = await db.select()
        .from(contractorQuotes)
        .where(
          and(
            eq(contractorQuotes.contractorId, contractor.id),
            eq(contractorQuotes.status, 'pending')
          )
        )
        .orderBy(desc(contractorQuotes.sentAt))
        .limit(5);

      if (pendingQuotes.length === 0) {
        return `Hi ${contractor.contactName || contractor.companyName}, you don't have any pending job requests at the moment. We'll send you new jobs as they come in. John Barclay Property Management`;
      }

      // Parse contractor response
      const response = await this.parseContractorResponse(messageBody);

      // Get the most recent pending quote
      const quote = pendingQuotes[0];

      // Get ticket details
      const ticket = await db.query.supportTickets.findFirst({
        where: eq(supportTickets.id, quote.ticketId)
      });

      if (!ticket) {
        return "We couldn't find the associated ticket. Please contact our office.";
      }

      // Process based on response type
      switch (response.type) {
        case 'accept':
          return await this.handleContractorAccept(contractor, quote, ticket);

        case 'decline':
          return await this.handleContractorDecline(contractor, quote, ticket, response.reason);

        case 'quote':
          return await this.handleContractorQuote(contractor, quote, ticket, response.amount!, response.date);

        default:
          return `Hi ${contractor.contactName || contractor.companyName}, I didn't understand your response for Ticket #${ticket.ticketNumber}.

Please reply with:
• YES - to accept the job
• NO - to decline (you can add a reason)
• QUOTE £XXX - to provide a quote amount
• QUOTE £XXX DATE DD/MM - with your available date

Or call us at 020 7123 4567`;
      }

    } catch (error) {
      console.error('[TenantSupport] Error processing contractor WhatsApp:', error);
      return "Sorry, we encountered an error processing your response. Please call our office at 020 7123 4567.";
    }
  }

  /**
   * Parse contractor response to determine intent
   */
  private parseContractorResponse(message: string): {
    type: 'accept' | 'decline' | 'quote' | 'unknown';
    amount?: number;
    date?: Date;
    reason?: string;
  } {
    const upperMessage = message.toUpperCase().trim();

    // Check for YES/accept
    if (upperMessage === 'YES' || upperMessage === 'ACCEPT' || upperMessage.startsWith('YES ')) {
      return { type: 'accept' };
    }

    // Check for NO/decline
    if (upperMessage === 'NO' || upperMessage === 'DECLINE' || upperMessage.startsWith('NO ')) {
      const reason = message.length > 3 ? message.substring(3).trim() : undefined;
      return { type: 'decline', reason };
    }

    // Check for QUOTE with amount
    const quoteMatch = message.match(/QUOTE\s*[£$]?\s*(\d+(?:\.\d{2})?)/i);
    if (quoteMatch) {
      const amount = Math.round(parseFloat(quoteMatch[1]) * 100); // Convert to pence

      // Check for date
      const dateMatch = message.match(/DATE\s*(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/i);
      let date: Date | undefined;
      if (dateMatch) {
        const day = parseInt(dateMatch[1]);
        const month = parseInt(dateMatch[2]) - 1;
        const year = dateMatch[3] ? parseInt(dateMatch[3]) : new Date().getFullYear();
        date = new Date(year < 100 ? 2000 + year : year, month, day);
      }

      return { type: 'quote', amount, date };
    }

    // Check for just a number (assume quote)
    const numberMatch = message.match(/^[£$]?\s*(\d+(?:\.\d{2})?)$/);
    if (numberMatch) {
      const amount = Math.round(parseFloat(numberMatch[1]) * 100);
      return { type: 'quote', amount };
    }

    return { type: 'unknown' };
  }

  /**
   * Handle contractor accepting a job
   */
  private async handleContractorAccept(contractor: any, quote: any, ticket: any): Promise<string> {
    // Update quote status
    await db.update(contractorQuotes)
      .set({
        status: 'accepted',
        respondedAt: new Date(),
        contractorResponse: 'Accepted',
        updatedAt: new Date()
      })
      .where(eq(contractorQuotes.id, quote.id));

    // Update ticket workflow status
    await db.update(supportTickets)
      .set({
        workflowStatus: 'quote_received',
        status: 'in_progress',
        updatedAt: new Date()
      })
      .where(eq(supportTickets.id, ticket.id));

    // Record workflow event
    await this.recordWorkflowEvent({
      ticketId: ticket.id,
      quoteId: quote.id,
      eventType: 'contractor_accepted',
      previousStatus: 'contractor_notified',
      newStatus: 'quote_received',
      triggeredBy: 'contractor',
      title: `${contractor.companyName} accepted the job`,
      description: 'Contractor accepted without providing a quote. Awaiting property manager review.',
      notificationSent: true,
      notificationChannels: ['email']
    });

    // Notify property manager
    await this.notifyPropertyManagerOfQuote(ticket, contractor, null, 'accepted');

    return `Thank you ${contractor.contactName || contractor.companyName}! You've accepted Ticket #${ticket.ticketNumber}.

Our property manager will be in touch to confirm scheduling.

If you'd like to provide a quote amount, reply: QUOTE £XXX

John Barclay Property Management`;
  }

  /**
   * Handle contractor declining a job
   */
  private async handleContractorDecline(contractor: any, quote: any, ticket: any, reason?: string): Promise<string> {
    // Update quote status
    await db.update(contractorQuotes)
      .set({
        status: 'declined',
        respondedAt: new Date(),
        contractorResponse: reason ? `Declined: ${reason}` : 'Declined',
        updatedAt: new Date()
      })
      .where(eq(contractorQuotes.id, quote.id));

    // Record workflow event
    await this.recordWorkflowEvent({
      ticketId: ticket.id,
      quoteId: quote.id,
      eventType: 'contractor_declined',
      previousStatus: 'contractor_notified',
      newStatus: 'contractor_notified',
      triggeredBy: 'contractor',
      title: `${contractor.companyName} declined the job`,
      description: reason || 'No reason provided',
      metadata: { reason },
      notificationSent: true,
      notificationChannels: ['email']
    });

    // Try to find another contractor
    const ticketCategory = TICKET_CATEGORIES[ticket.category as keyof typeof TICKET_CATEGORIES];
    const specialization = ticketCategory?.contractorSpecialization || 'general';

    const property = await db.query.properties.findFirst({
      where: eq(properties.id, ticket.propertyId)
    });

    const nextContractor = await this.findNextAvailableContractor(
      specialization,
      property?.postcode,
      [contractor.id] // Exclude the declining contractor
    );

    if (nextContractor) {
      // Assign to new contractor
      const classification: TicketClassification = {
        category: ticket.category,
        priority: ticket.priority as any,
        isEmergency: ticket.priority === 'urgent',
        suggestedContractorType: specialization,
        confidence: 1,
        summary: ticket.subject,
        suggestedResponse: ''
      };

      await this.notifyContractor(nextContractor, ticket, classification);

      // Notify property manager
      await this.notifyPropertyManagerOfQuote(ticket, contractor, null, 'declined', reason);

      return `Thank you for letting us know, ${contractor.contactName || contractor.companyName}. We've reassigned Ticket #${ticket.ticketNumber} to another contractor.

John Barclay Property Management`;
    } else {
      // Update ticket - needs manual assignment
      await db.update(supportTickets)
        .set({
          workflowStatus: 'new',
          contractorId: null,
          activeQuoteId: null,
          updatedAt: new Date()
        })
        .where(eq(supportTickets.id, ticket.id));

      // Notify property manager urgently
      await this.notifyPropertyManagerOfQuote(ticket, contractor, null, 'declined_no_alternative', reason);

      return `Thank you for letting us know, ${contractor.contactName || contractor.companyName}. Our team will find an alternative for Ticket #${ticket.ticketNumber}.

John Barclay Property Management`;
    }
  }

  /**
   * Handle contractor providing a quote
   */
  private async handleContractorQuote(contractor: any, quote: any, ticket: any, amount: number, availableDate?: Date): Promise<string> {
    // Update quote with amount
    await db.update(contractorQuotes)
      .set({
        status: 'quoted',
        quoteAmount: amount,
        availableDate: availableDate || null,
        respondedAt: new Date(),
        contractorResponse: `Quote: £${(amount / 100).toFixed(2)}${availableDate ? ` - Available: ${availableDate.toLocaleDateString('en-GB')}` : ''}`,
        updatedAt: new Date()
      })
      .where(eq(contractorQuotes.id, quote.id));

    // Update ticket workflow status
    await db.update(supportTickets)
      .set({
        workflowStatus: 'quote_received',
        status: 'in_progress',
        updatedAt: new Date()
      })
      .where(eq(supportTickets.id, ticket.id));

    // Record workflow event
    await this.recordWorkflowEvent({
      ticketId: ticket.id,
      quoteId: quote.id,
      eventType: 'quote_received',
      previousStatus: 'contractor_notified',
      newStatus: 'quote_received',
      triggeredBy: 'contractor',
      title: `Quote received: £${(amount / 100).toFixed(2)}`,
      description: `${contractor.companyName} quoted £${(amount / 100).toFixed(2)}${availableDate ? ` - Available: ${availableDate.toLocaleDateString('en-GB')}` : ''}`,
      metadata: { amount, availableDate },
      notificationSent: true,
      notificationChannels: ['email', 'whatsapp']
    });

    // Notify property manager
    await this.notifyPropertyManagerOfQuote(ticket, contractor, amount, 'quoted', undefined, availableDate);

    const dateInfo = availableDate ? `\nAvailable date: ${availableDate.toLocaleDateString('en-GB')}` : '';

    return `Thank you ${contractor.contactName || contractor.companyName}! Your quote for Ticket #${ticket.ticketNumber} has been received:

💷 Quote: £${(amount / 100).toFixed(2)}${dateInfo}

Our property manager will review and get back to you shortly to confirm.

John Barclay Property Management`;
  }

  /**
   * Notify property manager of contractor response
   */
  private async notifyPropertyManagerOfQuote(
    ticket: any,
    contractor: any,
    amount: number | null,
    responseType: 'accepted' | 'quoted' | 'declined' | 'declined_no_alternative',
    reason?: string,
    availableDate?: Date
  ): Promise<void> {
    const managerEmail = process.env.PROPERTY_MANAGER_EMAIL || 'property@johnbarclay.uk';

    // Get tenant and property details
    const tenant = await db.query.users.findFirst({
      where: eq(users.id, ticket.tenantId)
    });

    const property = await db.query.properties.findFirst({
      where: eq(properties.id, ticket.propertyId)
    });

    let subject = '';
    let statusColor = '';
    let actionRequired = '';

    switch (responseType) {
      case 'accepted':
        subject = `✅ Job Accepted - Ticket #${ticket.ticketNumber}`;
        statusColor = '#22c55e';
        actionRequired = 'Please schedule the work with the contractor.';
        break;
      case 'quoted':
        subject = `💷 Quote Received - Ticket #${ticket.ticketNumber} - £${amount ? (amount / 100).toFixed(2) : 'N/A'}`;
        statusColor = '#3b82f6';
        actionRequired = 'Please review and approve or reject the quote.';
        break;
      case 'declined':
        subject = `❌ Job Declined (Reassigned) - Ticket #${ticket.ticketNumber}`;
        statusColor = '#f59e0b';
        actionRequired = 'Job has been automatically reassigned to another contractor.';
        break;
      case 'declined_no_alternative':
        subject = `🚨 URGENT: Job Declined - No Alternative - Ticket #${ticket.ticketNumber}`;
        statusColor = '#dc2626';
        actionRequired = 'URGENT: Please manually assign a contractor to this ticket.';
        break;
    }

    await emailService.sendEmail({
      to: managerEmail,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: ${statusColor}; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">Contractor Response</h1>
            <p style="margin: 5px 0;">Ticket #${ticket.ticketNumber}</p>
          </div>
          <div style="padding: 30px; background: #f8f9fa;">
            <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="margin-top: 0; color: ${statusColor};">${responseType === 'accepted' ? 'Job Accepted' : responseType === 'quoted' ? 'Quote Received' : 'Job Declined'}</h2>

              <p><strong>Contractor:</strong> ${contractor.companyName}</p>
              <p><strong>Contact:</strong> ${contractor.contactName || 'N/A'} - ${contractor.phone}</p>

              ${amount ? `<p style="font-size: 24px; color: #3b82f6;"><strong>Quote Amount: £${(amount / 100).toFixed(2)}</strong></p>` : ''}
              ${availableDate ? `<p><strong>Available Date:</strong> ${availableDate.toLocaleDateString('en-GB')}</p>` : ''}
              ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
            </div>

            <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h3>Ticket Details</h3>
              <p><strong>Category:</strong> ${ticket.category}</p>
              <p><strong>Priority:</strong> ${ticket.priority}</p>
              <p><strong>Subject:</strong> ${ticket.subject}</p>
              <p><strong>Property:</strong> ${property?.addressLine1 || 'N/A'}, ${property?.postcode || ''}</p>
              <p><strong>Tenant:</strong> ${tenant?.fullName || 'N/A'}</p>
            </div>

            <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
              <strong>⚡ Action Required:</strong> ${actionRequired}
            </div>

            <a href="${process.env.BASE_URL || 'https://johnbarclay.uk'}/crm/support-tickets/${ticket.id}"
               style="display: inline-block; background: #791E75; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
              View Ticket in CRM
            </a>
          </div>
        </div>
      `
    });
  }

  /**
   * Find next available contractor (excluding specified IDs)
   */
  private async findNextAvailableContractor(
    specialization: string,
    postcode?: string,
    excludeIds: number[] = []
  ): Promise<any> {
    try {
      let query = db.select().from(contractors)
        .where(
          and(
            eq(contractors.isActive, true),
            sql`${specialization} = ANY(${contractors.specializations})`
          )
        )
        .orderBy(
          desc(contractors.preferredContractor),
          desc(contractors.rating)
        );

      const results = await query;

      // Filter out excluded contractors
      const available = results.filter(c => !excludeIds.includes(c.id));

      return available[0] || null;

    } catch (error) {
      console.error('[TenantSupport] Error finding next contractor:', error);
      return null;
    }
  }

  /**
   * Find contractor by phone number
   */
  private async findContractorByPhone(phone: string): Promise<any> {
    const normalizedPhone = this.normalizePhoneNumber(phone);

    try {
      const result = await db.select()
        .from(contractors)
        .where(
          sql`REPLACE(REPLACE(${contractors.phone}, ' ', ''), '+', '') LIKE '%' || REPLACE(REPLACE(${normalizedPhone}, ' ', ''), '+', '') || '%'`
        )
        .limit(1);

      return result[0] || null;
    } catch (error) {
      console.error('[TenantSupport] Error finding contractor by phone:', error);
      return null;
    }
  }

  /**
   * Classify message using AI
   */
  private async classifyMessage(message: string, attachments: string[]): Promise<TicketClassification> {
    const hasPhotos = attachments.length > 0;

    try {
      const prompt = `You are a property maintenance support classifier for a UK estate agency.

Analyze this tenant message and classify it:
"${message}"
${hasPhotos ? `\nThe tenant has also attached ${attachments.length} photo(s) showing the issue.` : ''}

Categories:
- plumbing: Water, pipes, drains, toilets, taps, boilers (water issues)
- electrical: Power, lights, sockets, fuses, circuits
- heating: Gas, heating, radiators, thermostats
- appliances: Washing machines, ovens, fridges, etc.
- structural: Walls, floors, ceilings, doors, windows, damp, mould
- pest: Mice, rats, insects, infestations
- exterior: Gardens, fences, parking, external areas
- billing: Rent, payments, deposits, charges
- general: Other enquiries

Priority levels:
- urgent: Immediate danger, gas leaks, flooding, no heating in winter, security breaches
- high: Major issues affecting habitability (no hot water, significant leaks, electrical issues)
- medium: Issues affecting comfort but not urgent
- low: Minor issues, general enquiries

Respond in JSON format:
{
  "category": "category_name",
  "priority": "low|medium|high|urgent",
  "isEmergency": true/false,
  "suggestedContractorType": "plumbing|electrical|gas|general|pest_control|appliances|null",
  "confidence": 0.0-1.0,
  "summary": "Brief one-line summary of the issue",
  "suggestedResponse": "Empathetic response acknowledging the issue"
}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(completion.choices[0].message.content || '{}');

      return {
        category: result.category || 'general',
        priority: result.priority || 'medium',
        isEmergency: result.isEmergency || false,
        suggestedContractorType: result.suggestedContractorType,
        confidence: result.confidence || 0.5,
        summary: result.summary || message.substring(0, 100),
        suggestedResponse: result.suggestedResponse || ''
      };

    } catch (error) {
      console.error('[TenantSupport] AI classification error:', error);
      // Fallback to keyword-based classification
      return this.keywordClassification(message);
    }
  }

  /**
   * Fallback keyword-based classification
   */
  private keywordClassification(message: string): TicketClassification {
    const messageLower = message.toLowerCase();
    let matchedCategory = 'general';
    let isEmergency = false;
    let priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium';
    let contractorType: string | null = null;

    for (const [category, config] of Object.entries(TICKET_CATEGORIES)) {
      // Check for urgent keywords first
      for (const keyword of config.urgencyKeywords) {
        if (messageLower.includes(keyword)) {
          matchedCategory = category;
          isEmergency = true;
          priority = 'urgent';
          contractorType = config.contractorSpecialization;
          break;
        }
      }

      if (isEmergency) break;

      // Check regular keywords
      for (const keyword of config.keywords) {
        if (messageLower.includes(keyword)) {
          matchedCategory = category;
          priority = config.defaultPriority as any;
          contractorType = config.contractorSpecialization;
          break;
        }
      }

      if (matchedCategory !== 'general') break;
    }

    return {
      category: matchedCategory,
      priority,
      isEmergency,
      suggestedContractorType: contractorType,
      confidence: isEmergency ? 0.9 : 0.7,
      summary: message.substring(0, 100),
      suggestedResponse: ''
    };
  }

  /**
   * Create support ticket
   */
  private async createSupportTicket(data: {
    tenantId: number;
    propertyId: number;
    category: string;
    subject: string;
    description: string;
    priority: string;
    attachments: string[];
    isEmergency: boolean;
    classification: TicketClassification;
  }): Promise<any> {
    const ticketNumber = this.generateTicketNumber();

    const [ticket] = await db.insert(supportTickets).values({
      tenantId: data.tenantId,
      propertyId: data.propertyId,
      ticketNumber,
      category: data.category,
      subject: data.subject,
      description: data.description,
      priority: data.priority,
      status: data.isEmergency ? 'urgent' : 'open',
      attachments: data.attachments
    }).returning();

    console.log(`[TenantSupport] Created ticket ${ticketNumber} - ${data.category} (${data.priority})`);

    return ticket;
  }

  /**
   * Route ticket to Property Manager for review and action
   * IMPORTANT: All tickets go through Property Manager - no direct tenant/contractor communication
   */
  private async routeTicket(ticket: any, classification: TicketClassification): Promise<void> {
    // Get property details for context
    const property = await db.query.properties.findFirst({
      where: eq(properties.id, ticket.propertyId)
    });

    // Find suggested contractors (for Property Manager reference only - not auto-assigned)
    let suggestedContractors: any[] = [];
    if (classification.suggestedContractorType) {
      const contractors = await db.select().from(contractors)
        .where(
          and(
            eq(contractors.isActive, true),
            sql`${classification.suggestedContractorType} = ANY(${contractors.specializations})`
          )
        )
        .orderBy(
          desc(contractors.preferredContractor),
          desc(contractors.rating)
        )
        .limit(3);
      suggestedContractors = contractors;
    }

    // Record workflow event - ticket awaiting property manager review
    await this.recordWorkflowEvent({
      ticketId: ticket.id,
      eventType: 'ticket_created',
      previousStatus: null,
      newStatus: 'new',
      triggeredBy: 'system',
      title: 'New support ticket received',
      description: `${classification.category} issue - ${classification.priority} priority. Awaiting property manager review.`,
      notificationSent: true,
      notificationChannels: ['email']
    });

    // Notify property manager via email - THEY decide what action to take
    await this.notifyPropertyManagerNewTicket(ticket, classification, property, suggestedContractors);

    // For emergencies, also send SMS alert to property manager
    if (classification.isEmergency) {
      await this.sendEmergencyAlerts(ticket, classification);
    }

    // Send acknowledgement to tenant (does NOT include contractor details)
    await this.sendTenantAcknowledgement(ticket, classification);
  }

  /**
   * Send acknowledgement to tenant that their ticket was received
   * Note: Does NOT share contractor details - only that team is reviewing
   */
  private async sendTenantAcknowledgement(ticket: any, classification: TicketClassification): Promise<void> {
    const tenant = await db.query.users.findFirst({
      where: eq(users.id, ticket.tenantId)
    });

    if (!tenant?.phone) return;

    const priorityMessage = classification.isEmergency
      ? '🚨 This has been marked as URGENT and our team will respond as quickly as possible.'
      : 'Our property management team will review your request and get back to you shortly.';

    const message = `Thank you for contacting John Barclay Property Management.

Your request has been received:
📋 Ticket: #${ticket.ticketNumber}
📝 Category: ${classification.category}

${priorityMessage}

You will receive updates as we progress with your request.

If this is a life-threatening emergency, please call 999.

John Barclay Property Management
📞 020 7123 4567`;

    if (twilioClient) {
      try {
        await twilioClient.messages.create({
          body: message,
          from: fromWhatsApp,
          to: `whatsapp:${this.normalizePhoneNumber(tenant.phone)}`
        });
      } catch (error) {
        console.error('[TenantSupport] Error sending tenant acknowledgement:', error);
      }
    }
  }

  /**
   * Notify Property Manager of new ticket with suggested contractors
   */
  private async notifyPropertyManagerNewTicket(
    ticket: any,
    classification: TicketClassification,
    property: any,
    suggestedContractors: any[]
  ): Promise<void> {
    const managerEmail = process.env.PROPERTY_MANAGER_EMAIL || 'property@johnbarclay.uk';

    const tenant = await db.query.users.findFirst({
      where: eq(users.id, ticket.tenantId)
    });

    const contractorList = suggestedContractors.length > 0
      ? suggestedContractors.map(c => `<li>${c.companyName} - ${c.phone} (${c.responseTime})</li>`).join('')
      : '<li>No matching contractors found - manual assignment required</li>';

    await emailService.sendEmail({
      to: managerEmail,
      subject: `${classification.isEmergency ? '🚨 URGENT: ' : ''}New Support Ticket #${ticket.ticketNumber} - ${classification.category}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: ${classification.isEmergency ? '#dc2626' : '#791E75'}; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">${classification.isEmergency ? '🚨 URGENT ' : ''}New Support Ticket</h1>
            <p style="margin: 5px 0;">Ticket #${ticket.ticketNumber}</p>
          </div>
          <div style="padding: 30px; background: #f8f9fa;">
            <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="margin-top: 0;">Ticket Details</h2>
              <p><strong>Category:</strong> ${classification.category}</p>
              <p><strong>Priority:</strong> <span style="color: ${classification.priority === 'urgent' ? '#dc2626' : '#000'}">${classification.priority.toUpperCase()}</span></p>
              <p><strong>Subject:</strong> ${ticket.subject}</p>
              <hr>
              <p><strong>Description:</strong></p>
              <p>${ticket.description}</p>
              ${ticket.attachments?.length ? `<p><strong>📷 Photos:</strong> ${ticket.attachments.length} attached</p>` : ''}
            </div>

            <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h3>Tenant Information</h3>
              <p><strong>Name:</strong> ${tenant?.fullName || 'N/A'}</p>
              <p><strong>Phone:</strong> ${tenant?.phone || 'N/A'}</p>
              <p><strong>Email:</strong> ${tenant?.email || 'N/A'}</p>
            </div>

            <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h3>Property</h3>
              <p>${property?.addressLine1 || 'N/A'}</p>
              <p>${property?.postcode || ''}</p>
            </div>

            <div style="background: #e0f2fe; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h3 style="margin-top: 0;">💡 Suggested Contractors</h3>
              <p style="font-size: 14px; color: #666;">Based on the issue category, these contractors may be suitable:</p>
              <ul style="margin: 10px 0;">
                ${contractorList}
              </ul>
              <p style="font-size: 12px; color: #888;"><em>Please review and assign via the CRM dashboard.</em></p>
            </div>

            <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
              <strong>⚡ Action Required:</strong>
              <ol style="margin: 10px 0; padding-left: 20px;">
                <li>Review the ticket details</li>
                <li>Assign a contractor from the CRM</li>
                <li>Contractor will provide a quote</li>
                <li>Approve quote and schedule work</li>
                <li>Keep tenant updated on progress</li>
              </ol>
            </div>

            <a href="${process.env.BASE_URL || 'https://johnbarclay.uk'}/crm/support-tickets"
               style="display: inline-block; background: #791E75; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
              Open CRM Dashboard
            </a>
          </div>
        </div>
      `
    });
  }

  /**
   * Find best contractor for the job
   */
  private async findBestContractor(
    specialization: string,
    postcode?: string,
    isEmergency: boolean = false
  ): Promise<any> {
    try {
      const query = db.select().from(contractors)
        .where(
          and(
            eq(contractors.isActive, true),
            sql`${specialization} = ANY(${contractors.specializations})`
          )
        )
        .orderBy(
          desc(contractors.preferredContractor),
          desc(contractors.rating)
        )
        .limit(1);

      const result = await query;
      return result[0] || null;

    } catch (error) {
      console.error('[TenantSupport] Error finding contractor:', error);
      return null;
    }
  }

  /**
   * Notify contractor of new job and create quote record
   */
  private async notifyContractor(contractor: any, ticket: any, classification: TicketClassification): Promise<void> {
    // Get tenant and property details
    const tenant = await db.query.users.findFirst({
      where: eq(users.id, ticket.tenantId)
    });

    const property = await db.query.properties.findFirst({
      where: eq(properties.id, ticket.propertyId)
    });

    // Create a quote record to track contractor response
    const [quote] = await db.insert(contractorQuotes).values({
      ticketId: ticket.id,
      contractorId: contractor.id,
      status: 'pending',
      sentAt: new Date()
    }).returning();

    // Update ticket with contractor and workflow status
    await db.update(supportTickets)
      .set({
        contractorId: contractor.id,
        contractorAssignedAt: new Date(),
        workflowStatus: 'contractor_notified',
        activeQuoteId: quote.id,
        updatedAt: new Date()
      })
      .where(eq(supportTickets.id, ticket.id));

    // Record workflow event
    await this.recordWorkflowEvent({
      ticketId: ticket.id,
      quoteId: quote.id,
      eventType: 'contractor_notified',
      previousStatus: 'new',
      newStatus: 'contractor_notified',
      triggeredBy: 'system',
      title: `Job sent to ${contractor.companyName}`,
      description: `Waiting for contractor to accept job and provide quote`,
      notificationSent: true,
      notificationChannels: ['whatsapp', 'email']
    });

    // Send WhatsApp notification with quote request
    if (contractor.phone && twilioClient) {
      const message = `🔧 NEW JOB REQUEST - ${classification.isEmergency ? '🚨 EMERGENCY' : 'Standard'}

Ticket: #${ticket.ticketNumber}
Quote Ref: Q${quote.id}
Category: ${classification.category.toUpperCase()}
Priority: ${classification.priority.toUpperCase()}

Property: ${property?.addressLine1 || 'N/A'}, ${property?.postcode || ''}
Tenant: ${tenant?.fullName || 'N/A'}
Contact: ${tenant?.phone || 'N/A'}

Issue: ${ticket.subject}
Details: ${ticket.description?.substring(0, 200)}${ticket.description?.length > 200 ? '...' : ''}

${ticket.attachments?.length ? `📷 ${ticket.attachments.length} photo(s) attached` : ''}

---
📋 PLEASE RESPOND:
• Reply YES to accept this job
• Reply NO to decline
• Reply QUOTE £XXX to provide a quote (e.g. "QUOTE £150")
• Reply QUOTE £XXX DATE DD/MM for quote with available date

John Barclay Property Management
☎️ 020 7123 4567`;

      try {
        await twilioClient.messages.create({
          body: message,
          from: fromWhatsApp,
          to: `whatsapp:${this.normalizePhoneNumber(contractor.phone)}`
        });

        console.log(`[TenantSupport] Job request sent to contractor ${contractor.companyName} for ticket #${ticket.ticketNumber}`);
      } catch (error) {
        console.error('[TenantSupport] Error notifying contractor:', error);
      }
    }

    // Also send email
    if (contractor.email) {
      await emailService.sendEmail({
        to: contractor.email,
        subject: `New Job Request - Ticket #${ticket.ticketNumber} ${classification.isEmergency ? '🚨 EMERGENCY' : ''}`,
        html: this.generateContractorEmailHtml(ticket, classification, tenant, property, quote.id)
      });
    }
  }

  /**
   * Record a workflow event for tracking
   */
  private async recordWorkflowEvent(data: {
    ticketId: number;
    quoteId?: number;
    eventType: string;
    previousStatus?: string;
    newStatus?: string;
    triggeredBy: string;
    userId?: number;
    title: string;
    description?: string;
    metadata?: any;
    notificationSent?: boolean;
    notificationChannels?: string[];
  }): Promise<void> {
    try {
      await db.insert(ticketWorkflowEvents).values({
        ticketId: data.ticketId,
        quoteId: data.quoteId,
        eventType: data.eventType,
        previousStatus: data.previousStatus,
        newStatus: data.newStatus,
        triggeredBy: data.triggeredBy,
        userId: data.userId,
        title: data.title,
        description: data.description,
        metadata: data.metadata,
        notificationSent: data.notificationSent || false,
        notificationChannels: data.notificationChannels
      });
    } catch (error) {
      console.error('[TenantSupport] Error recording workflow event:', error);
    }
  }

  /**
   * Notify property manager
   */
  private async notifyPropertyManager(ticket: any, classification: TicketClassification, contractor: any): Promise<void> {
    // Send to property management email
    const managerEmail = process.env.PROPERTY_MANAGER_EMAIL || 'property@johnbarclay.uk';

    await emailService.sendEmail({
      to: managerEmail,
      subject: `[${classification.priority.toUpperCase()}] New Support Ticket #${ticket.ticketNumber} - ${classification.category}`,
      html: this.generateManagerEmailHtml(ticket, classification, contractor)
    });
  }

  /**
   * Send emergency alerts via multiple channels
   */
  private async sendEmergencyAlerts(ticket: any, classification: TicketClassification): Promise<void> {
    const emergencyContacts = [
      process.env.EMERGENCY_PHONE_1,
      process.env.EMERGENCY_PHONE_2
    ].filter(Boolean);

    for (const phone of emergencyContacts) {
      // Send SMS
      if (twilioClient) {
        try {
          await twilioClient.messages.create({
            body: `🚨 EMERGENCY TICKET #${ticket.ticketNumber}\n${classification.category}: ${ticket.subject}\nProperty ID: ${ticket.propertyId}\nCheck CRM immediately.`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: phone!
          });
        } catch (error) {
          console.error('[TenantSupport] Error sending emergency SMS:', error);
        }
      }
    }
  }

  /**
   * Generate AI response for tenant
   */
  private async generateAIResponse(
    tenant: any,
    originalMessage: string,
    classification: TicketClassification,
    ticketNumber: string
  ): Promise<string> {
    try {
      const prompt = `You are a friendly property management support assistant for John Barclay Estate Agents in London.

A tenant named ${tenant.fullName || 'the tenant'} has reported:
"${originalMessage}"

This has been classified as: ${classification.category} (${classification.priority} priority)
${classification.isEmergency ? 'This is being treated as an EMERGENCY.' : ''}

Generate a helpful, empathetic WhatsApp response that:
1. Acknowledges their issue
2. Provides the ticket number: ${ticketNumber}
3. Explains what happens next
4. Gives emergency contact if urgent
5. Keeps it concise (max 200 words)
6. Uses appropriate emojis sparingly

${classification.isEmergency ? 'Include the emergency number: 020 7123 4567' : ''}

Do not use markdown. Use plain text with emojis.`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300
      });

      return completion.choices[0].message.content || this.getDefaultResponse(ticketNumber, classification);

    } catch (error) {
      console.error('[TenantSupport] AI response error:', error);
      return this.getDefaultResponse(ticketNumber, classification);
    }
  }

  /**
   * Default response if AI fails
   */
  private getDefaultResponse(ticketNumber: string, classification: TicketClassification): string {
    const urgentSuffix = classification.isEmergency
      ? '\n\n🚨 For immediate assistance, please call our emergency line: 020 7123 4567'
      : '';

    return `Thank you for contacting John Barclay Property Support.

Your ticket #${ticketNumber} has been created for: ${classification.summary}

We've categorized this as a ${classification.priority} priority ${classification.category} issue.

Our team has been notified and will respond shortly. You can reply to this message to add more information.${urgentSuffix}

John Barclay Property Management`;
  }

  /**
   * Handle response to existing ticket
   */
  private async handleTicketResponse(
    state: any,
    message: string,
    attachments: string[],
    tenant: any
  ): Promise<string> {
    // Add comment to ticket
    await db.insert(ticketComments).values({
      ticketId: state.currentTicketId,
      userId: tenant.id,
      comment: message,
      attachments,
      isInternal: false
    });

    // Update ticket updated_at
    await db.update(supportTickets)
      .set({ updatedAt: new Date() })
      .where(eq(supportTickets.id, state.currentTicketId));

    return `Thank you for the additional information. Your message has been added to ticket #${state.currentTicketId}.

Our team will review this and get back to you.

Reply "NEW" to start a new ticket or continue this conversation.`;
  }

  /**
   * Handle commands like STATUS, NEW, HELP
   */
  private async handleCommand(command: string, tenant: any, state: any): Promise<string> {
    switch (command.toUpperCase()) {
      case 'STATUS':
        return await this.getTicketStatus(tenant.id);

      case 'NEW':
        state.currentTicketId = null;
        return 'Starting a new support request. Please describe your issue and attach any photos if relevant.';

      case 'HELP':
        return `John Barclay Tenant Support Help:

📝 *Report Issue* - Just describe your problem
📷 *Attach Photos* - Send images with your message
📊 *STATUS* - Check your open tickets
🆕 *NEW* - Start a new ticket
📞 *CALL* - Request a callback

Emergency? Call 020 7123 4567

Our support team is available Mon-Fri 9am-5pm
Weekend emergencies handled 24/7`;

      case 'CALL':
        // TODO: Integrate with callback system
        return 'A member of our team will call you shortly. If this is urgent, please call 020 7123 4567 directly.';

      default:
        return '';
    }
  }

  /**
   * Get ticket status for tenant
   */
  private async getTicketStatus(tenantId: number): Promise<string> {
    const tickets = await db.select()
      .from(supportTickets)
      .where(
        and(
          eq(supportTickets.tenantId, tenantId),
          inArray(supportTickets.status, ['open', 'in_progress', 'waiting_tenant'])
        )
      )
      .orderBy(desc(supportTickets.createdAt))
      .limit(5);

    if (tickets.length === 0) {
      return 'You have no open support tickets. Reply with your issue to create a new one.';
    }

    let response = '📋 Your Open Tickets:\n\n';
    for (const ticket of tickets) {
      const statusEmoji = {
        open: '🔵',
        in_progress: '🟡',
        waiting_tenant: '🟠',
        resolved: '🟢',
        closed: '⚫'
      }[ticket.status] || '⚪';

      response += `${statusEmoji} #${ticket.ticketNumber}\n`;
      response += `   ${ticket.subject}\n`;
      response += `   Status: ${ticket.status.replace('_', ' ')}\n\n`;
    }

    response += 'Reply with a ticket number for details or "NEW" to create a new ticket.';
    return response;
  }

  /**
   * Record all communication for 360-degree tracking
   */
  private async recordCommunication(data: {
    channel: 'whatsapp' | 'email' | 'phone' | 'sms';
    direction: 'inbound' | 'outbound';
    phoneNumber?: string;
    email?: string;
    content: string;
    attachments?: string[];
    tenantId?: number;
    ticketId?: number;
  }): Promise<void> {
    try {
      // Find or create conversation
      let conversation;
      if (data.tenantId) {
        const existing = await db.query.conversations.findFirst({
          where: and(
            eq(conversations.userId, data.tenantId),
            eq(conversations.channel, data.channel)
          )
        });

        if (!existing) {
          const [newConv] = await db.insert(conversations).values({
            userId: data.tenantId,
            channel: data.channel,
            status: 'active',
            lastMessageAt: new Date()
          }).returning();
          conversation = newConv;
        } else {
          conversation = existing;
          await db.update(conversations)
            .set({ lastMessageAt: new Date() })
            .where(eq(conversations.id, existing.id));
        }
      }

      // Record message
      if (conversation) {
        await db.insert(messages).values({
          conversationId: conversation.id,
          senderId: data.direction === 'inbound' ? data.tenantId : null,
          content: data.content,
          channel: data.channel,
          direction: data.direction,
          attachments: data.attachments,
          metadata: data.ticketId ? { ticketId: data.ticketId } : undefined,
          status: 'delivered'
        });
      }

    } catch (error) {
      console.error('[TenantSupport] Error recording communication:', error);
    }
  }

  /**
   * Send WhatsApp message to tenant
   */
  async sendWhatsAppToTenant(phoneNumber: string, message: string, ticketId?: number): Promise<boolean> {
    if (!twilioClient) {
      console.error('[TenantSupport] Twilio not configured');
      return false;
    }

    try {
      const toWhatsApp = `whatsapp:${this.normalizePhoneNumber(phoneNumber)}`;

      await twilioClient.messages.create({
        body: message,
        from: fromWhatsApp,
        to: toWhatsApp
      });

      // Record outbound communication
      await this.recordCommunication({
        channel: 'whatsapp',
        direction: 'outbound',
        phoneNumber,
        content: message,
        ticketId
      });

      return true;

    } catch (error) {
      console.error('[TenantSupport] Error sending WhatsApp:', error);
      return false;
    }
  }

  /**
   * Send ticket update notification across all channels
   */
  async sendTicketUpdate(ticketId: number, updateMessage: string, channels: ('whatsapp' | 'email' | 'sms')[] = ['whatsapp', 'email']): Promise<void> {
    const ticket = await db.query.supportTickets.findFirst({
      where: eq(supportTickets.id, ticketId)
    });

    if (!ticket) return;

    const tenant = await db.query.users.findFirst({
      where: eq(users.id, ticket.tenantId)
    });

    if (!tenant) return;

    const fullMessage = `📋 Ticket Update #${ticket.ticketNumber}

${updateMessage}

Reply to this message if you have questions.

John Barclay Property Management`;

    // WhatsApp
    if (channels.includes('whatsapp') && tenant.phone) {
      await this.sendWhatsAppToTenant(tenant.phone, fullMessage, ticketId);
    }

    // Email
    if (channels.includes('email') && tenant.email) {
      await emailService.sendEmail({
        to: tenant.email,
        subject: `Ticket Update #${ticket.ticketNumber} - John Barclay`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #791E75; color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0;">John Barclay</h1>
              <p style="margin: 5px 0;">Property Management</p>
            </div>
            <div style="padding: 30px; background: #f8f9fa;">
              <h2>Ticket Update</h2>
              <p>Dear ${tenant.fullName},</p>
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Ticket:</strong> #${ticket.ticketNumber}</p>
                <p><strong>Subject:</strong> ${ticket.subject}</p>
                <hr>
                <p>${updateMessage}</p>
              </div>
              <p>If you have any questions, please reply to this email or message us on WhatsApp.</p>
            </div>
          </div>
        `
      });
    }

    // SMS
    if (channels.includes('sms') && tenant.phone && twilioClient) {
      try {
        await twilioClient.messages.create({
          body: `Ticket #${ticket.ticketNumber} Update: ${updateMessage.substring(0, 140)}`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: this.normalizePhoneNumber(tenant.phone)
        });
      } catch (error) {
        console.error('[TenantSupport] Error sending SMS:', error);
      }
    }
  }

  // Helper methods

  private async findTenantByPhone(phone: string): Promise<any> {
    const normalizedPhone = this.normalizePhoneNumber(phone);

    // Search in users table
    const user = await db.query.users.findFirst({
      where: sql`REPLACE(REPLACE(${users.phone}, ' ', ''), '+', '') LIKE '%' || REPLACE(REPLACE(${normalizedPhone}, ' ', ''), '+', '') || '%'`
    });

    if (user) {
      // Get associated property if tenant
      const tenantRecord = await db.query.tenant.findFirst({
        where: eq(tenant.userId, user.id)
      });

      return {
        ...user,
        propertyId: tenantRecord?.propertyId || 1 // Default to 1 for now
      };
    }

    return null;
  }

  private normalizePhoneNumber(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');

    if (cleaned.startsWith('0')) {
      cleaned = '44' + cleaned.substring(1);
    }

    if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }

    return cleaned;
  }

  private extractMediaUrls(message: IncomingWhatsAppMessage): string[] {
    const urls: string[] = [];
    const numMedia = parseInt(message.NumMedia || '0', 10);

    for (let i = 0; i < numMedia; i++) {
      const url = (message as any)[`MediaUrl${i}`];
      if (url) urls.push(url);
    }

    return urls;
  }

  private parseCommand(message: string): string | null {
    const commands = ['STATUS', 'NEW', 'HELP', 'CALL'];
    const upperMessage = message.trim().toUpperCase();

    return commands.includes(upperMessage) ? upperMessage : null;
  }

  private isConversationStale(lastMessageTime: Date): boolean {
    const hoursSinceLastMessage = (Date.now() - lastMessageTime.getTime()) / (1000 * 60 * 60);
    return hoursSinceLastMessage > 24;
  }

  private generateTicketNumber(): string {
    const prefix = 'JB';
    const date = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}${date}${random}`;
  }

  private generateUnknownTenantResponse(phoneNumber: string): string {
    return `Thank you for contacting John Barclay Property Support.

We couldn't find your phone number in our system. If you're a tenant, please:

1. Ensure you're using the phone number registered with us
2. Contact our office to update your details: 020 7123 4567
3. Email: tenants@johnbarclay.uk

If this is a general enquiry, please visit johnbarclay.uk`;
  }

  private generateContractorEmailHtml(ticket: any, classification: TicketClassification, tenant: any, property: any, quoteId?: number): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: ${classification.isEmergency ? '#dc2626' : '#791E75'}; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">${classification.isEmergency ? '🚨 EMERGENCY ' : ''}Job Request</h1>
        </div>
        <div style="padding: 30px; background: #f8f9fa;">
          <h2>Ticket #${ticket.ticketNumber}</h2>
          ${quoteId ? `<p style="color: #666;">Quote Reference: Q${quoteId}</p>` : ''}
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Category:</strong> ${classification.category}</p>
            <p><strong>Priority:</strong> ${classification.priority.toUpperCase()}</p>
            <p><strong>Property:</strong> ${property?.addressLine1 || 'N/A'}, ${property?.postcode || ''}</p>
            <p><strong>Tenant:</strong> ${tenant?.fullName || 'N/A'}</p>
            <p><strong>Contact:</strong> ${tenant?.phone || 'N/A'}</p>
            <hr>
            <p><strong>Issue:</strong></p>
            <p>${ticket.description}</p>
            ${ticket.attachments?.length ? `<p><strong>Photos attached:</strong> ${ticket.attachments.length}</p>` : ''}
          </div>
          <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <strong>📋 How to Respond:</strong>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li>Reply to the WhatsApp message with <strong>YES</strong> to accept</li>
              <li>Reply <strong>NO</strong> to decline (with optional reason)</li>
              <li>Reply <strong>QUOTE £XXX</strong> to provide a quote</li>
              <li>Reply <strong>QUOTE £XXX DATE DD/MM</strong> with your available date</li>
            </ul>
          </div>
          <p>Please respond to this job request as soon as possible.</p>
          <a href="${process.env.BASE_URL || 'https://johnbarclay.uk'}/crm/tickets/${ticket.id}"
             style="display: inline-block; background: #791E75; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
            View in CRM
          </a>
        </div>
      </div>
    `;
  }

  private generateManagerEmailHtml(ticket: any, classification: TicketClassification, contractor: any): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: ${classification.isEmergency ? '#dc2626' : '#791E75'}; color: white; padding: 20px;">
          <h1 style="margin: 0;">${classification.isEmergency ? '🚨 EMERGENCY ' : ''}Support Ticket</h1>
          <p style="margin: 5px 0;">Ticket #${ticket.ticketNumber}</p>
        </div>
        <div style="padding: 30px; background: #f8f9fa;">
          <div style="background: white; padding: 20px; border-radius: 8px;">
            <p><strong>Category:</strong> ${classification.category}</p>
            <p><strong>Priority:</strong> <span style="color: ${classification.priority === 'urgent' ? '#dc2626' : '#000'}">${classification.priority.toUpperCase()}</span></p>
            <p><strong>Subject:</strong> ${ticket.subject}</p>
            <p><strong>Description:</strong> ${ticket.description}</p>
            <hr>
            <p><strong>Assigned Contractor:</strong> ${contractor?.companyName || 'Not yet assigned'}</p>
            ${ticket.attachments?.length ? `<p><strong>Attachments:</strong> ${ticket.attachments.length} photo(s)</p>` : ''}
          </div>
          <div style="margin-top: 20px;">
            <a href="${process.env.BASE_URL || 'https://johnbarclay.uk'}/crm/support-tickets/${ticket.id}"
               style="display: inline-block; background: #791E75; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
              Manage Ticket
            </a>
          </div>
        </div>
      </div>
    `;
  }
}

// Export singleton instance
export const tenantSupportService = new TenantSupportService();
