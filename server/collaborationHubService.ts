import twilio from 'twilio';
import { db } from './db';
import {
  conversations,
  messages,
  users,
  properties,
  customerEnquiries,
  viewingAppointments,
  maintenanceTickets
} from '@shared/schema';
import { eq, and, desc, sql, like, or, gte, lte } from 'drizzle-orm';
import { openaiClient, isOpenAIConfigured } from './lib/openaiClient';

// Initialize clients
const openai = openaiClient;

const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

/**
 * WhatsApp Collaboration Hub Service
 * Handles team communication, client messaging, and automated workflows via WhatsApp
 */
export class CollaborationHubService {

  // Message templates for common scenarios
  private readonly TEMPLATES = {
    viewing_confirmation: {
      name: 'viewing_confirmation',
      text: `Hi {{name}}, your viewing is confirmed!\n\n📍 *{{address}}*\n📅 {{date}} at {{time}}\n\nOur agent {{agent_name}} will meet you there.\n\nReply HELP if you need anything!`
    },
    viewing_reminder: {
      name: 'viewing_reminder',
      text: `Hi {{name}}, reminder about your viewing tomorrow!\n\n📍 *{{address}}*\n⏰ {{time}}\n\nReply YES to confirm or RESCHEDULE if needed.`
    },
    valuation_followup: {
      name: 'valuation_followup',
      text: `Hi {{name}}, following up on your recent valuation at {{address}}.\n\nHave you had a chance to consider our proposal?\n\nReply if you'd like to discuss next steps.`
    },
    new_property_match: {
      name: 'new_property_match',
      text: `Hi {{name}}, great news! 🏠\n\nA new property matching your criteria just listed:\n\n*{{property_title}}*\n📍 {{address}}\n💷 {{price}}\n🛏️ {{bedrooms}} bedrooms\n\nReply VIEW for details or BOOK to arrange a viewing!`
    },
    maintenance_update: {
      name: 'maintenance_update',
      text: `Hi {{name}}, update on your maintenance request:\n\n🔧 *{{issue}}*\n📊 Status: {{status}}\n👷 {{contractor}} scheduled for {{date}}\n\nReply if you have any questions.`
    },
    payment_reminder: {
      name: 'payment_reminder',
      text: `Hi {{name}}, friendly reminder that your rent payment of {{amount}} is due on {{due_date}}.\n\nPlease ensure payment is made on time to avoid any issues.\n\nReply PAID if already processed.`
    },
    team_task_assignment: {
      name: 'team_task_assignment',
      text: `🔔 *New Task Assigned*\n\n{{task_description}}\n\n🏠 Property: {{property_address}}\n👤 Client: {{client_name}}\n⏰ Due: {{due_date}}\n\nReply ACCEPT or DELEGATE.`
    },
    team_urgent_alert: {
      name: 'team_urgent_alert',
      text: `🚨 *URGENT*\n\n{{alert_message}}\n\nPlease respond immediately.\n\nReply ACKNOWLEDGED when seen.`
    }
  };

  constructor() {
    console.log('Collaboration Hub Service initialized');
  }

  /**
   * Format UK phone number for WhatsApp
   */
  private formatWhatsAppNumber(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');

    if (cleaned.startsWith('0')) {
      cleaned = '+44' + cleaned.substring(1);
    } else if (cleaned.startsWith('44')) {
      cleaned = '+' + cleaned;
    } else if (!cleaned.startsWith('+')) {
      cleaned = '+44' + cleaned;
    }

    return `whatsapp:${cleaned}`;
  }

  /**
   * Send a WhatsApp message
   */
  async sendWhatsAppMessage(
    to: string,
    message: string,
    context?: { conversationId?: number; propertyId?: number }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const toWhatsApp = this.formatWhatsAppNumber(to);

      const result = await twilioClient.messages.create({
        body: message,
        from: TWILIO_WHATSAPP_NUMBER,
        to: toWhatsApp
      });

      // Store message in database
      if (context?.conversationId) {
        await db.insert(messages).values({
          conversationId: context.conversationId,
          channel: 'whatsapp',
          direction: 'outbound',
          fromAddress: TWILIO_WHATSAPP_NUMBER,
          toAddress: toWhatsApp,
          content: message,
          status: 'sent',
          sentAt: new Date(),
          externalMessageId: result.sid
        });
      }

      console.log(`WhatsApp message sent to ${to}: ${result.sid}`);
      return { success: true, messageId: result.sid };
    } catch (error: any) {
      console.error('Error sending WhatsApp message:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send templated WhatsApp message
   */
  async sendTemplatedMessage(
    to: string,
    templateName: string,
    variables: Record<string, string>,
    context?: { conversationId?: number; propertyId?: number }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const template = this.TEMPLATES[templateName as keyof typeof this.TEMPLATES];
    if (!template) {
      return { success: false, error: `Template ${templateName} not found` };
    }

    let message = template.text;
    for (const [key, value] of Object.entries(variables)) {
      message = message.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    return this.sendWhatsAppMessage(to, message, context);
  }

  /**
   * Handle incoming WhatsApp message webhook
   */
  async handleIncomingMessage(webhookData: any): Promise<{ response?: string; actions?: string[] }> {
    const from = webhookData.From;
    const body = webhookData.Body?.trim() || '';
    const messageSid = webhookData.MessageSid;

    console.log(`Incoming WhatsApp from ${from}: ${body}`);

    // Find or create conversation
    const conversation = await this.findOrCreateConversation(from);

    // Store incoming message
    await db.insert(messages).values({
      conversationId: conversation.id,
      channel: 'whatsapp',
      direction: 'inbound',
      fromAddress: from,
      toAddress: TWILIO_WHATSAPP_NUMBER,
      content: body,
      status: 'delivered',
      deliveredAt: new Date(),
      externalMessageId: messageSid
    });

    // Update conversation
    await db.update(conversations)
      .set({
        lastMessageAt: new Date(),
        lastMessagePreview: body.substring(0, 100),
        unreadCount: sql`${conversations.unreadCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(conversations.id, conversation.id));

    // Process message with AI
    const aiResponse = await this.processMessageWithAI(body, conversation);

    // Handle quick reply commands
    const quickResponse = this.handleQuickReply(body.toUpperCase());
    if (quickResponse) {
      await this.sendWhatsAppMessage(from.replace('whatsapp:', ''), quickResponse.message, {
        conversationId: conversation.id
      });
      return { response: quickResponse.message, actions: quickResponse.actions };
    }

    // If AI response is ready and appropriate, send it
    if (aiResponse.autoReply && aiResponse.response) {
      await this.sendWhatsAppMessage(from.replace('whatsapp:', ''), aiResponse.response, {
        conversationId: conversation.id
      });
      return { response: aiResponse.response, actions: aiResponse.actions };
    }

    // Otherwise, notify team member for manual response
    await this.notifyTeamMember(conversation.id, body);

    return { actions: ['manual_review_required'] };
  }

  /**
   * Find or create conversation for a WhatsApp number
   */
  private async findOrCreateConversation(whatsappNumber: string): Promise<any> {
    const phone = whatsappNumber.replace('whatsapp:', '').replace('+', '');

    // Look for existing conversation
    const [existing] = await db.select()
      .from(conversations)
      .where(like(conversations.contactPhone, `%${phone.slice(-10)}%`))
      .orderBy(desc(conversations.updatedAt))
      .limit(1);

    if (existing) {
      return existing;
    }

    // Create new conversation
    const [newConvo] = await db.insert(conversations).values({
      contactPhone: whatsappNumber.replace('whatsapp:', ''),
      contactName: 'WhatsApp User',
      status: 'open',
      priority: 'normal'
    }).returning();

    return newConvo;
  }

  /**
   * Process message with AI
   */
  private async processMessageWithAI(
    message: string,
    conversation: any
  ): Promise<{ response?: string; autoReply: boolean; actions: string[] }> {
    try {
      // Get conversation history
      const history = await db.select()
        .from(messages)
        .where(eq(messages.conversationId, conversation.id))
        .orderBy(desc(messages.createdAt))
        .limit(10);

      // Build context for AI
      const conversationContext = history.reverse().map(m => ({
        role: m.direction === 'inbound' ? 'user' : 'assistant',
        content: m.content
      }));

      const systemPrompt = `You are a helpful assistant for John Barclay Estate & Management.
You're responding to WhatsApp messages from clients.

Your capabilities:
- Answer property enquiries
- Help with viewing bookings
- Provide maintenance updates
- Answer general questions about services

Guidelines:
- Be concise (WhatsApp messages should be brief)
- Use emojis sparingly for friendliness
- If unsure or it's a complex issue, set autoReply: false to have a human follow up
- Extract any actionable items (like booking requests)

Return JSON with:
- response: string (your reply)
- autoReply: boolean (true if you're confident this is appropriate)
- actions: string[] (any actions to trigger, like "book_viewing", "create_ticket")
- sentiment: string (positive/neutral/negative)`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationContext as any,
          { role: 'user', content: message }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7
      });

      const result = JSON.parse(completion.choices[0].message.content || '{}');

      return {
        response: result.response,
        autoReply: result.autoReply ?? false,
        actions: result.actions || []
      };
    } catch (error) {
      console.error('Error processing message with AI:', error);
      return { autoReply: false, actions: ['ai_error'] };
    }
  }

  /**
   * Handle quick reply commands
   */
  private handleQuickReply(command: string): { message: string; actions: string[] } | null {
    const commands: Record<string, { message: string; actions: string[] }> = {
      'YES': {
        message: "Great! Your appointment is confirmed. We'll see you then! Reply HELP if you need anything else.",
        actions: ['confirm_appointment']
      },
      'RESCHEDULE': {
        message: "No problem! What day and time works better for you? Or reply CALL to have our team call you.",
        actions: ['reschedule_request']
      },
      'VIEW': {
        message: "Perfect! I'll send you the full property details now. Would you like to book a viewing? Reply BOOK to proceed.",
        actions: ['send_property_details']
      },
      'BOOK': {
        message: "Excellent choice! What day and time works best for you? We have slots available between 9am-6pm, Monday to Saturday.",
        actions: ['start_booking_flow']
      },
      'HELP': {
        message: "I'm here to help! You can:\n\n📞 CALL - Request a callback\n🏠 SEARCH - Find properties\n📅 BOOK - Book a viewing\n❓ QUESTION - Ask anything\n\nWhat would you like to do?",
        actions: ['show_menu']
      },
      'CALL': {
        message: "Of course! One of our agents will call you within the next 30 minutes. Is this the best number to reach you?",
        actions: ['request_callback']
      },
      'ACCEPT': {
        message: "Task accepted! ✅ I've updated the system. Good luck!",
        actions: ['accept_task']
      },
      'ACKNOWLEDGED': {
        message: "Noted. Thank you for responding quickly.",
        actions: ['acknowledge_alert']
      },
      'PAID': {
        message: "Thank you for confirming! We'll update our records once the payment clears. 🙏",
        actions: ['confirm_payment']
      }
    };

    return commands[command] || null;
  }

  /**
   * Notify team member about new message
   */
  private async notifyTeamMember(conversationId: number, message: string): Promise<void> {
    // Get assigned agent or find available one
    const [convo] = await db.select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (!convo) return;

    let agentPhone: string | null = null;

    if (convo.assignedToId) {
      const [agent] = await db.select()
        .from(users)
        .where(eq(users.id, convo.assignedToId))
        .limit(1);
      agentPhone = agent?.phone || null;
    }

    // If no assigned agent, notify the duty manager
    if (!agentPhone) {
      const dutyManagerPhone = process.env.DUTY_MANAGER_PHONE;
      if (dutyManagerPhone) {
        agentPhone = dutyManagerPhone;
      }
    }

    if (agentPhone) {
      const notification = `📱 *New WhatsApp Message*\n\nFrom: ${convo.contactName || convo.contactPhone}\nMessage: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"\n\nReply to this thread or log in to respond.`;

      await this.sendWhatsAppMessage(agentPhone, notification);
    }
  }

  // ==========================================
  // TEAM COLLABORATION FEATURES
  // ==========================================

  /**
   * Send team broadcast message
   */
  async sendTeamBroadcast(
    message: string,
    department?: string
  ): Promise<{ success: boolean; sent: number; failed: number }> {
    try {
      // Get team members
      const conditions = [eq(users.isActive, true)];

      if (department) {
        conditions.push(eq(users.department, department));
      }

      const teamMembers = await db.select()
        .from(users)
        .where(and(...conditions));
      let sent = 0;
      let failed = 0;

      for (const member of teamMembers) {
        if (member.phone) {
          const result = await this.sendWhatsAppMessage(member.phone, message);
          if (result.success) {
            sent++;
          } else {
            failed++;
          }
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      return { success: true, sent, failed };
    } catch (error) {
      console.error('Error sending team broadcast:', error);
      return { success: false, sent: 0, failed: 0 };
    }
  }

  /**
   * Assign task to team member via WhatsApp
   */
  async assignTaskViaWhatsApp(
    agentId: number,
    taskDescription: string,
    context: {
      propertyAddress?: string;
      clientName?: string;
      dueDate?: string;
      urgent?: boolean;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const [agent] = await db.select()
        .from(users)
        .where(eq(users.id, agentId))
        .limit(1);

      if (!agent?.phone) {
        return { success: false, error: 'Agent has no phone number configured' };
      }

      const template = context.urgent ? 'team_urgent_alert' : 'team_task_assignment';
      const variables = {
        task_description: taskDescription,
        property_address: context.propertyAddress || 'N/A',
        client_name: context.clientName || 'N/A',
        due_date: context.dueDate || 'ASAP',
        alert_message: context.urgent ? taskDescription : ''
      };

      return await this.sendTemplatedMessage(agent.phone, template, variables);
    } catch (error: any) {
      console.error('Error assigning task via WhatsApp:', error);
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // CLIENT COMMUNICATION FEATURES
  // ==========================================

  /**
   * Send viewing confirmation to client
   */
  async sendViewingConfirmation(viewingId: number): Promise<{ success: boolean; error?: string }> {
    try {
      const [viewing] = await db.select()
        .from(viewingAppointments)
        .where(eq(viewingAppointments.id, viewingId))
        .limit(1);

      if (!viewing) {
        return { success: false, error: 'Viewing not found' };
      }

      const [property] = await db.select()
        .from(properties)
        .where(eq(properties.id, viewing.propertyId))
        .limit(1);

      const variables = {
        name: viewing.viewerName,
        address: property ? `${property.addressLine1}, ${property.postcode}` : 'Property address',
        date: new Date(viewing.scheduledDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }),
        time: new Date(viewing.scheduledDate).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        agent_name: 'Our agent'
      };

      return await this.sendTemplatedMessage(
        viewing.viewerPhone,
        'viewing_confirmation',
        variables
      );
    } catch (error: any) {
      console.error('Error sending viewing confirmation:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send viewing reminder to client (called day before)
   */
  async sendViewingReminder(viewingId: number): Promise<{ success: boolean; error?: string }> {
    try {
      const [viewing] = await db.select()
        .from(viewingAppointments)
        .where(eq(viewingAppointments.id, viewingId))
        .limit(1);

      if (!viewing) {
        return { success: false, error: 'Viewing not found' };
      }

      const [property] = await db.select()
        .from(properties)
        .where(eq(properties.id, viewing.propertyId))
        .limit(1);

      const variables = {
        name: viewing.viewerName,
        address: property ? `${property.addressLine1}, ${property.postcode}` : 'Property address',
        time: new Date(viewing.scheduledDate).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      };

      return await this.sendTemplatedMessage(
        viewing.viewerPhone,
        'viewing_reminder',
        variables
      );
    } catch (error: any) {
      console.error('Error sending viewing reminder:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send new property alert to matching clients
   */
  async sendPropertyAlerts(propertyId: number): Promise<{ success: boolean; sent: number }> {
    try {
      const [property] = await db.select()
        .from(properties)
        .where(eq(properties.id, propertyId))
        .limit(1);

      if (!property) {
        return { success: false, sent: 0 };
      }

      // Find matching enquiries
      const matchingEnquiries = await db.select()
        .from(customerEnquiries)
        .where(and(
          eq(customerEnquiries.status, 'qualified'),
          eq(customerEnquiries.enquiryType, property.listingType === 'sale' ? 'buying' : 'renting')
        ))
        .limit(50);

      let sent = 0;

      for (const enquiry of matchingEnquiries) {
        if (!enquiry.customerPhone) continue;

        const variables = {
          name: enquiry.customerName,
          property_title: property.title,
          address: `${property.addressLine1}, ${property.postcode}`,
          price: `£${(property.price / 100).toLocaleString()}`,
          bedrooms: property.bedrooms.toString()
        };

        const result = await this.sendTemplatedMessage(
          enquiry.customerPhone,
          'new_property_match',
          variables
        );

        if (result.success) {
          sent++;
          // Update enquiry
          await db.update(customerEnquiries)
            .set({ propertyMatchesSent: true, updatedAt: new Date() })
            .where(eq(customerEnquiries.id, enquiry.id));
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      return { success: true, sent };
    } catch (error) {
      console.error('Error sending property alerts:', error);
      return { success: false, sent: 0 };
    }
  }

  /**
   * Send maintenance update to tenant
   */
  async sendMaintenanceUpdate(ticketId: number): Promise<{ success: boolean; error?: string }> {
    try {
      const [ticket] = await db.select()
        .from(maintenanceTickets)
        .where(eq(maintenanceTickets.id, ticketId))
        .limit(1);

      if (!ticket) {
        return { success: false, error: 'Ticket not found' };
      }

      const [tenant] = await db.select()
        .from(users)
        .where(eq(users.id, ticket.tenantId))
        .limit(1);

      if (!tenant?.phone) {
        return { success: false, error: 'Tenant has no phone number' };
      }

      const variables = {
        name: tenant.fullName,
        issue: ticket.title,
        status: ticket.status,
        contractor: 'Our maintenance team',
        date: ticket.assignedAt ? new Date(ticket.assignedAt).toLocaleDateString('en-GB') : 'TBC'
      };

      return await this.sendTemplatedMessage(
        tenant.phone,
        'maintenance_update',
        variables
      );
    } catch (error: any) {
      console.error('Error sending maintenance update:', error);
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // ANALYTICS AND REPORTING
  // ==========================================

  /**
   * Get WhatsApp conversation metrics
   */
  async getConversationMetrics(period: string = 'week'): Promise<any> {
    try {
      const startDate = new Date();
      if (period === 'week') {
        startDate.setDate(startDate.getDate() - 7);
      } else if (period === 'month') {
        startDate.setMonth(startDate.getMonth() - 1);
      }

      const totalConversations = await db.select({ count: sql<number>`count(*)` })
        .from(conversations)
        .where(gte(conversations.createdAt, startDate));

      const totalMessages = await db.select({ count: sql<number>`count(*)` })
        .from(messages)
        .where(and(
          eq(messages.channel, 'whatsapp'),
          gte(messages.createdAt, startDate)
        ));

      const inboundMessages = await db.select({ count: sql<number>`count(*)` })
        .from(messages)
        .where(and(
          eq(messages.channel, 'whatsapp'),
          eq(messages.direction, 'inbound'),
          gte(messages.createdAt, startDate)
        ));

      const outboundMessages = await db.select({ count: sql<number>`count(*)` })
        .from(messages)
        .where(and(
          eq(messages.channel, 'whatsapp'),
          eq(messages.direction, 'outbound'),
          gte(messages.createdAt, startDate)
        ));

      return {
        period,
        totalConversations: totalConversations[0]?.count || 0,
        totalMessages: totalMessages[0]?.count || 0,
        inboundMessages: inboundMessages[0]?.count || 0,
        outboundMessages: outboundMessages[0]?.count || 0,
        responseRate: 95, // Placeholder - calculate from actual data
        averageResponseTime: '8 minutes' // Placeholder
      };
    } catch (error) {
      console.error('Error getting conversation metrics:', error);
      return null;
    }
  }

  /**
   * Get open conversations for dashboard
   */
  async getOpenConversations(limit: number = 20): Promise<any[]> {
    try {
      const convos = await db.select()
        .from(conversations)
        .where(or(
          eq(conversations.status, 'open'),
          eq(conversations.status, 'pending')
        ))
        .orderBy(desc(conversations.lastMessageAt))
        .limit(limit);

      return convos;
    } catch (error) {
      console.error('Error getting open conversations:', error);
      return [];
    }
  }

  /**
   * Get conversation history
   */
  async getConversationHistory(conversationId: number): Promise<any[]> {
    try {
      const msgs = await db.select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(messages.createdAt);

      return msgs;
    } catch (error) {
      console.error('Error getting conversation history:', error);
      return [];
    }
  }
}

// Export singleton instance
export const collaborationHub = new CollaborationHubService();
