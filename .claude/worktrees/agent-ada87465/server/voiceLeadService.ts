/**
 * Voice Lead Service
 *
 * Handles lead identification, history lookup, and post-call information delivery
 * for the AI receptionist system.
 */

import { db } from './db';
import {
  leads,
  leadCommunications,
  voiceCallRecords,
  voiceLeadPropertyInterests,
  properties,
  InsertVoiceCallRecord,
  VoiceCallRecord
} from '@shared/schema';
import { eq, or, and, desc, sql } from 'drizzle-orm';
import twilio from 'twilio';
import nodemailer from 'nodemailer';
import { openaiClient } from './lib/openaiClient';

// Initialize clients
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

// Email transporter
const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
});

interface LeadHistory {
  lead: {
    id: number;
    fullName: string;
    email: string | null;
    phone: string | null;
    mobile: string | null;
    leadType: string;
    preferredPropertyType: string | null;
    preferredBedrooms: number | null;
    preferredAreas: string[] | null;
    minBudget: number | null;
    maxBudget: number | null;
    status: string;
    priority: string | null;
    score: number | null;
    notes: string | null;
    createdAt: Date;
  };
  previousCalls: {
    id: number;
    callSid: string;
    direction: string;
    startedAt: Date;
    duration: number | null;
    aiSummary: string | null;
    aiIntent: string | null;
    propertiesDiscussed: number[] | null;
    viewingBooked: boolean | null;
  }[];
  propertyInterests: {
    propertyId: number;
    propertyAddress: string;
    propertyPrice: number;
    interestLevel: string | null;
    timesMentioned: number;
    viewingRequested: boolean | null;
    viewingCompleted: boolean;
  }[];
  recentCommunications: {
    id: number;
    channel: string;
    direction: string;
    type: string;
    summary: string | null;
    createdAt: Date;
  }[];
}

interface CallAnalysis {
  summary: string;
  intent: string;
  sentiment: string;
  urgency: string;
  leadScore: number;
  extractedInfo: {
    name?: string;
    email?: string;
    phone?: string;
    budgetMin?: number;
    budgetMax?: number;
    bedrooms?: number;
    areas?: string[];
    propertyType?: string;
    moveInDate?: string;
    requirements?: string[];
  };
  propertiesInterestedIn: number[];
  propertiesRejected: number[];
  actionItems: string[];
  followUpRequired: boolean;
  followUpNotes?: string;
}

class VoiceLeadService {

  /**
   * Find existing lead by phone number
   * Returns lead history if found, null if new caller
   */
  async findLeadByPhone(phoneNumber: string): Promise<LeadHistory | null> {
    // Normalize phone number (remove spaces, handle +44 vs 0)
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
    const alternatePhone = this.getAlternatePhoneFormat(normalizedPhone);

    // Search for lead by phone or mobile
    const existingLead = await db.select()
      .from(leads)
      .where(
        or(
          eq(leads.phone, normalizedPhone),
          eq(leads.mobile, normalizedPhone),
          eq(leads.phone, alternatePhone),
          eq(leads.mobile, alternatePhone)
        )
      )
      .limit(1);

    if (existingLead.length === 0) {
      return null;
    }

    const lead = existingLead[0];

    // Get previous voice calls
    const previousCalls = await db.select({
      id: voiceCallRecords.id,
      callSid: voiceCallRecords.callSid,
      direction: voiceCallRecords.direction,
      startedAt: voiceCallRecords.startedAt,
      duration: voiceCallRecords.duration,
      aiSummary: voiceCallRecords.aiSummary,
      aiIntent: voiceCallRecords.aiIntent,
      propertiesDiscussed: voiceCallRecords.propertiesDiscussed,
      viewingBooked: voiceCallRecords.viewingBooked
    })
      .from(voiceCallRecords)
      .where(eq(voiceCallRecords.leadId, lead.id))
      .orderBy(desc(voiceCallRecords.startedAt))
      .limit(5);

    // Get property interests with property details
    const propertyInterests = await db.select({
      propertyId: voiceLeadPropertyInterests.propertyId,
      interestLevel: voiceLeadPropertyInterests.interestLevel,
      timesMentioned: voiceLeadPropertyInterests.timesMentioned,
      viewingRequested: voiceLeadPropertyInterests.viewingRequested,
      viewingCompletedAt: voiceLeadPropertyInterests.viewingCompletedAt,
      propertyAddress: sql<string>`COALESCE(${properties.addressLine1}, '') || ', ' || COALESCE(${properties.postcode}, '')`,
      propertyPrice: properties.price
    })
      .from(voiceLeadPropertyInterests)
      .leftJoin(properties, eq(voiceLeadPropertyInterests.propertyId, properties.id))
      .where(eq(voiceLeadPropertyInterests.leadId, lead.id))
      .orderBy(desc(voiceLeadPropertyInterests.timesMentioned))
      .limit(10);

    // Get recent communications
    const recentComms = await db.select({
      id: leadCommunications.id,
      channel: leadCommunications.channel,
      direction: leadCommunications.direction,
      type: leadCommunications.type,
      summary: leadCommunications.summary,
      createdAt: leadCommunications.createdAt
    })
      .from(leadCommunications)
      .where(eq(leadCommunications.leadId, lead.id))
      .orderBy(desc(leadCommunications.createdAt))
      .limit(5);

    return {
      lead: {
        id: lead.id,
        fullName: lead.fullName,
        email: lead.email,
        phone: lead.phone,
        mobile: lead.mobile,
        leadType: lead.leadType,
        preferredPropertyType: lead.preferredPropertyType,
        preferredBedrooms: lead.preferredBedrooms,
        preferredAreas: lead.preferredAreas,
        minBudget: lead.minBudget,
        maxBudget: lead.maxBudget,
        status: lead.status,
        priority: lead.priority,
        score: lead.score,
        notes: lead.notes,
        createdAt: lead.createdAt
      },
      previousCalls: previousCalls,
      propertyInterests: propertyInterests.map(pi => ({
        propertyId: pi.propertyId,
        propertyAddress: pi.propertyAddress || 'Unknown',
        propertyPrice: pi.propertyPrice || 0,
        interestLevel: pi.interestLevel,
        timesMentioned: pi.timesMentioned,
        viewingRequested: pi.viewingRequested,
        viewingCompleted: !!pi.viewingCompletedAt
      })),
      recentCommunications: recentComms
    };
  }

  /**
   * Create a new lead from call information
   */
  async createLeadFromCall(
    phoneNumber: string,
    extractedInfo: {
      name?: string;
      email?: string;
      budgetMin?: number;
      budgetMax?: number;
      bedrooms?: number;
      areas?: string[];
      propertyType?: string;
      leadType?: string;
    }
  ): Promise<number> {
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

    const result = await db.insert(leads).values({
      fullName: extractedInfo.name || 'Phone Caller',
      email: extractedInfo.email,
      phone: normalizedPhone,
      mobile: normalizedPhone,
      source: 'phone_call',
      sourceDetail: 'AI Receptionist',
      leadType: extractedInfo.leadType || 'rental',
      preferredPropertyType: extractedInfo.propertyType,
      preferredBedrooms: extractedInfo.bedrooms,
      preferredAreas: extractedInfo.areas,
      minBudget: extractedInfo.budgetMin,
      maxBudget: extractedInfo.budgetMax,
      status: 'new',
      priority: 'warm',
      score: 50
    }).returning({ id: leads.id });

    return result[0].id;
  }

  /**
   * Update existing lead with new information from call
   */
  async updateLeadFromCall(
    leadId: number,
    extractedInfo: {
      name?: string;
      email?: string;
      budgetMin?: number;
      budgetMax?: number;
      bedrooms?: number;
      areas?: string[];
      propertyType?: string;
    }
  ): Promise<void> {
    const updates: any = {
      updatedAt: new Date(),
      lastActivityAt: new Date()
    };

    // Only update fields that have values and differ from existing
    if (extractedInfo.name && extractedInfo.name !== 'Phone Caller') {
      updates.fullName = extractedInfo.name;
    }
    if (extractedInfo.email) {
      updates.email = extractedInfo.email;
    }
    if (extractedInfo.budgetMin) {
      updates.minBudget = extractedInfo.budgetMin;
    }
    if (extractedInfo.budgetMax) {
      updates.maxBudget = extractedInfo.budgetMax;
    }
    if (extractedInfo.bedrooms) {
      updates.preferredBedrooms = extractedInfo.bedrooms;
    }
    if (extractedInfo.areas && extractedInfo.areas.length > 0) {
      updates.preferredAreas = extractedInfo.areas;
    }
    if (extractedInfo.propertyType) {
      updates.preferredPropertyType = extractedInfo.propertyType;
    }

    await db.update(leads)
      .set(updates)
      .where(eq(leads.id, leadId));
  }

  /**
   * Save a voice call record
   */
  async saveCallRecord(callData: InsertVoiceCallRecord): Promise<number> {
    const result = await db.insert(voiceCallRecords)
      .values(callData)
      .returning({ id: voiceCallRecords.id });

    return result[0].id;
  }

  /**
   * Update call record with analysis results
   */
  async updateCallWithAnalysis(
    callSid: string,
    analysis: CallAnalysis,
    leadId?: number
  ): Promise<void> {
    await db.update(voiceCallRecords)
      .set({
        leadId,
        aiSummary: analysis.summary,
        aiIntent: analysis.intent,
        aiSentiment: analysis.sentiment,
        aiUrgency: analysis.urgency,
        aiLeadScore: analysis.leadScore,
        extractedName: analysis.extractedInfo.name,
        extractedEmail: analysis.extractedInfo.email,
        extractedBudgetMin: analysis.extractedInfo.budgetMin,
        extractedBudgetMax: analysis.extractedInfo.budgetMax,
        extractedBedrooms: analysis.extractedInfo.bedrooms,
        extractedAreas: analysis.extractedInfo.areas,
        extractedPropertyType: analysis.extractedInfo.propertyType,
        extractedRequirements: analysis.extractedInfo.requirements,
        propertiesInterestedIn: analysis.propertiesInterestedIn,
        propertiesRejected: analysis.propertiesRejected,
        followUpRequired: analysis.followUpRequired,
        followUpNotes: analysis.followUpNotes,
        updatedAt: new Date()
      })
      .where(eq(voiceCallRecords.callSid, callSid));
  }

  /**
   * Record property interest from call
   */
  async recordPropertyInterest(
    leadId: number,
    propertyId: number,
    callId: number,
    interestLevel: 'high' | 'medium' | 'low' | 'rejected' = 'medium',
    rejectionReason?: string
  ): Promise<void> {
    // Check if this interest already exists
    const existing = await db.select()
      .from(voiceLeadPropertyInterests)
      .where(and(
        eq(voiceLeadPropertyInterests.leadId, leadId),
        eq(voiceLeadPropertyInterests.propertyId, propertyId)
      ))
      .limit(1);

    if (existing.length > 0) {
      // Update existing record
      await db.update(voiceLeadPropertyInterests)
        .set({
          timesMentioned: sql`${voiceLeadPropertyInterests.timesMentioned} + 1`,
          interestLevel,
          rejectionReason: rejectionReason || existing[0].rejectionReason,
          updatedAt: new Date()
        })
        .where(eq(voiceLeadPropertyInterests.id, existing[0].id));
    } else {
      // Create new interest record
      await db.insert(voiceLeadPropertyInterests).values({
        leadId,
        propertyId,
        firstMentionedCallId: callId,
        interestLevel,
        rejectionReason
      });
    }
  }

  /**
   * Analyze call transcript using AI
   */
  async analyzeCallTranscript(transcript: string, propertiesDiscussed?: number[]): Promise<CallAnalysis> {
    try {
      const response = await openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an AI assistant analyzing estate agent call transcripts. Extract key information and return a JSON object with the following structure:
{
  "summary": "2-3 sentence summary of the call",
  "intent": "property_enquiry_rent|property_enquiry_buy|book_viewing|valuation_request|maintenance|general_enquiry|complaint",
  "sentiment": "positive|neutral|negative",
  "urgency": "immediate|within_week|within_month|browsing",
  "leadScore": 0-100 based on likelihood of conversion,
  "extractedInfo": {
    "name": "caller's name if mentioned",
    "email": "email if mentioned",
    "phone": "any additional phone numbers mentioned",
    "budgetMin": number in GBP if mentioned,
    "budgetMax": number in GBP if mentioned,
    "bedrooms": number if mentioned,
    "areas": ["array of postcodes or areas mentioned like W9, Maida Vale"],
    "propertyType": "flat|house|studio|any",
    "moveInDate": "ISO date if mentioned",
    "requirements": ["array of specific requirements like garden, parking, pets"]
  },
  "propertiesInterestedIn": [property IDs they showed interest in],
  "propertiesRejected": [property IDs they weren't interested in],
  "actionItems": ["array of follow-up actions needed"],
  "followUpRequired": true/false,
  "followUpNotes": "what needs to be followed up"
}

Properties discussed in this call had IDs: ${propertiesDiscussed?.join(', ') || 'none'}`
          },
          { role: 'user', content: transcript }
        ],
        response_format: { type: 'json_object' }
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');

      return {
        summary: analysis.summary || '',
        intent: analysis.intent || 'general_enquiry',
        sentiment: analysis.sentiment || 'neutral',
        urgency: analysis.urgency || 'browsing',
        leadScore: analysis.leadScore || 50,
        extractedInfo: analysis.extractedInfo || {},
        propertiesInterestedIn: analysis.propertiesInterestedIn || [],
        propertiesRejected: analysis.propertiesRejected || [],
        actionItems: analysis.actionItems || [],
        followUpRequired: analysis.followUpRequired || false,
        followUpNotes: analysis.followUpNotes
      };
    } catch (error) {
      console.error('Error analyzing call transcript:', error);
      return {
        summary: 'Call transcript analysis failed',
        intent: 'general_enquiry',
        sentiment: 'neutral',
        urgency: 'browsing',
        leadScore: 50,
        extractedInfo: {},
        propertiesInterestedIn: [],
        propertiesRejected: [],
        actionItems: [],
        followUpRequired: true,
        followUpNotes: 'Manual review required - AI analysis failed'
      };
    }
  }

  /**
   * Send property information via WhatsApp
   */
  async sendInfoViaWhatsApp(
    phoneNumber: string,
    leadName: string,
    propertyIds: number[]
  ): Promise<boolean> {
    if (!twilioClient || propertyIds.length === 0) {
      return false;
    }

    try {
      // Fetch property details
      const propertyDetails = await db.select()
        .from(properties)
        .where(sql`${properties.id} IN (${sql.join(propertyIds.map(id => sql`${id}`), sql`, `)})`)
        .limit(5);

      if (propertyDetails.length === 0) {
        return false;
      }

      // Format message
      const propertyList = propertyDetails.map(p => {
        const price = p.price ? `£${(p.price / 100).toLocaleString()}` : 'Price on application';
        return `🏠 *${p.addressLine1}*\n${p.bedrooms || '?'} bed ${p.propertyType || 'property'}\n${price}\nhttps://johnbarclay.uk/properties/${p.id}`;
      }).join('\n\n');

      const message = `Hi ${leadName}! 👋\n\nThank you for calling John Barclay Estate & Management. Here are the properties we discussed:\n\n${propertyList}\n\nWould you like to book a viewing? Just reply to this message or call us on +447367087752.\n\n- Sarah, John Barclay Estate Agency`;

      const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

      await twilioClient.messages.create({
        from: process.env.TWILIO_WHATSAPP_NUMBER,
        to: `whatsapp:${normalizedPhone}`,
        body: message
      });

      return true;
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      return false;
    }
  }

  /**
   * Send property information via Email
   */
  async sendInfoViaEmail(
    email: string,
    leadName: string,
    propertyIds: number[]
  ): Promise<boolean> {
    if (propertyIds.length === 0 || !email) {
      return false;
    }

    try {
      // Fetch property details
      const propertyDetails = await db.select()
        .from(properties)
        .where(sql`${properties.id} IN (${sql.join(propertyIds.map(id => sql`${id}`), sql`, `)})`)
        .limit(5);

      if (propertyDetails.length === 0) {
        return false;
      }

      // Format HTML email
      const propertyHtml = propertyDetails.map(p => {
        const price = p.price ? `£${(p.price / 100).toLocaleString()}` : 'Price on application';
        const imageUrl = p.images && p.images.length > 0
          ? p.images[0]
          : 'https://johnbarclay.uk/placeholder-property.jpg';

        return `
          <div style="margin-bottom: 24px; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
            <img src="${imageUrl}" alt="${p.addressLine1}" style="width: 100%; height: 200px; object-fit: cover;" />
            <div style="padding: 16px;">
              <h3 style="margin: 0 0 8px 0; color: #1a365d;">${p.addressLine1}</h3>
              <p style="margin: 0 0 8px 0; color: #4a5568;">${p.bedrooms || '?'} bedroom ${p.propertyType || 'property'} • ${p.postcode}</p>
              <p style="margin: 0 0 16px 0; font-size: 18px; font-weight: bold; color: #2c5282;">${price}</p>
              <a href="https://johnbarclay.uk/properties/${p.id}" style="display: inline-block; background: #2c5282; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">View Property</a>
            </div>
          </div>
        `;
      }).join('');

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <img src="https://johnbarclay.uk/logo.png" alt="John Barclay" style="height: 50px; margin-bottom: 24px;" />

          <h2 style="color: #1a365d;">Hi ${leadName},</h2>

          <p style="color: #4a5568; line-height: 1.6;">
            Thank you for calling John Barclay Estate & Management. As promised, here are the details of the properties we discussed:
          </p>

          ${propertyHtml}

          <div style="margin-top: 32px; padding: 20px; background: #f7fafc; border-radius: 8px;">
            <h3 style="margin: 0 0 12px 0; color: #1a365d;">Ready to Book a Viewing?</h3>
            <p style="margin: 0 0 16px 0; color: #4a5568;">
              I'd be happy to arrange viewings at your convenience. Just reply to this email or give us a call.
            </p>
            <p style="margin: 0; color: #4a5568;">
              <strong>Phone:</strong> +44 7367 087752<br />
              <strong>Email:</strong> lettings@johnbarclay.co.uk
            </p>
          </div>

          <p style="margin-top: 32px; color: #4a5568;">
            Best regards,<br />
            <strong>Sarah</strong><br />
            John Barclay Estate & Management
          </p>

          <hr style="margin: 32px 0; border: none; border-top: 1px solid #e0e0e0;" />

          <p style="font-size: 12px; color: #718096;">
            John Barclay Estate & Management<br />
            West London Property Specialists<br />
            <a href="https://johnbarclay.uk" style="color: #2c5282;">www.johnbarclay.uk</a>
          </p>
        </body>
        </html>
      `;

      await emailTransporter.sendMail({
        from: `"John Barclay Estate Agency" <${process.env.SMTP_FROM || 'lettings@johnbarclay.co.uk'}>`,
        to: email,
        subject: `Property Information from John Barclay - ${propertyDetails[0].addressLine1}`,
        html: htmlContent
      });

      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }

  /**
   * Mark that info was sent to a lead
   */
  async markInfoSent(
    callId: number,
    leadId: number,
    propertyIds: number[],
    via: 'email' | 'whatsapp' | 'both'
  ): Promise<void> {
    // Update call record
    await db.update(voiceCallRecords)
      .set({
        infoSentVia: via,
        infoSentAt: new Date(),
        propertiesSent: propertyIds,
        updatedAt: new Date()
      })
      .where(eq(voiceCallRecords.id, callId));

    // Update property interest records
    for (const propertyId of propertyIds) {
      await db.update(voiceLeadPropertyInterests)
        .set({
          infoSentAt: new Date(),
          infoSentVia: via,
          updatedAt: new Date()
        })
        .where(and(
          eq(voiceLeadPropertyInterests.leadId, leadId),
          eq(voiceLeadPropertyInterests.propertyId, propertyId)
        ));
    }

    // Log communication
    await db.insert(leadCommunications).values({
      leadId,
      channel: via === 'both' ? 'email' : via,
      direction: 'outbound',
      type: 'follow_up',
      content: `Property information sent for ${propertyIds.length} properties`,
      summary: `Sent property details for IDs: ${propertyIds.join(', ')}`
    });
  }

  /**
   * Generate context string for AI from lead history
   */
  generateContextFromHistory(history: LeadHistory): string {
    const parts: string[] = [];

    parts.push(`RETURNING CALLER: ${history.lead.fullName}`);
    parts.push(`Customer since: ${history.lead.createdAt.toLocaleDateString()}`);
    parts.push(`Status: ${history.lead.status} (${history.lead.priority} priority)`);
    parts.push(`Looking for: ${history.lead.leadType} properties`);

    if (history.lead.preferredBedrooms) {
      parts.push(`Preferences: ${history.lead.preferredBedrooms} bedrooms`);
    }
    if (history.lead.preferredAreas && history.lead.preferredAreas.length > 0) {
      parts.push(`Preferred areas: ${history.lead.preferredAreas.join(', ')}`);
    }
    if (history.lead.minBudget || history.lead.maxBudget) {
      const min = history.lead.minBudget ? `£${(history.lead.minBudget / 100).toLocaleString()}` : '?';
      const max = history.lead.maxBudget ? `£${(history.lead.maxBudget / 100).toLocaleString()}` : '?';
      parts.push(`Budget: ${min} - ${max}`);
    }

    if (history.previousCalls.length > 0) {
      parts.push(`\nPREVIOUS CALLS (${history.previousCalls.length}):`);
      for (const call of history.previousCalls.slice(0, 3)) {
        parts.push(`- ${call.startedAt.toLocaleDateString()}: ${call.aiSummary || call.aiIntent || 'No summary'}`);
      }
    }

    if (history.propertyInterests.length > 0) {
      parts.push(`\nPROPERTIES OF INTEREST:`);
      for (const interest of history.propertyInterests.slice(0, 5)) {
        const price = `£${(interest.propertyPrice / 100).toLocaleString()}`;
        const viewing = interest.viewingCompleted ? '(viewed)' : interest.viewingRequested ? '(viewing requested)' : '';
        parts.push(`- ${interest.propertyAddress} (${price}) - ${interest.interestLevel} interest ${viewing}`);
      }
    }

    if (history.lead.notes) {
      parts.push(`\nNOTES: ${history.lead.notes}`);
    }

    return parts.join('\n');
  }

  // Helper: Normalize phone number to consistent format
  private normalizePhoneNumber(phone: string): string {
    // Remove all non-digit characters
    let digits = phone.replace(/\D/g, '');

    // Handle UK numbers
    if (digits.startsWith('44')) {
      digits = '0' + digits.slice(2);
    } else if (digits.startsWith('0044')) {
      digits = '0' + digits.slice(4);
    }

    // Ensure it starts with 0 for UK numbers
    if (!digits.startsWith('0') && digits.length === 10) {
      digits = '0' + digits;
    }

    return digits;
  }

  // Helper: Get alternate phone format (+44 vs 0)
  private getAlternatePhoneFormat(phone: string): string {
    if (phone.startsWith('0')) {
      return '+44' + phone.slice(1);
    } else if (phone.startsWith('+44')) {
      return '0' + phone.slice(3);
    }
    return phone;
  }
}

export const voiceLeadService = new VoiceLeadService();
