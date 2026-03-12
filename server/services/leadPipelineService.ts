/**
 * Lead Pipeline Service
 *
 * Creates and manages leads from email enquiries.
 * Handles lead creation, property interest tracking, communication logging,
 * and pipeline progression based on email activity.
 */

import { db } from '../db';
import {
  leads,
  leadPropertyViews,
  leadCommunications,
  leadActivities,
  InsertLead,
} from '@shared/schema';
import { eq, and, ilike } from 'drizzle-orm';
import type { AiAnalysisResult } from './email/emailProcessor';

export interface LeadCreationResult {
  leadId: number;
  isNew: boolean;
  status: string;
}

class LeadPipelineService {

  /**
   * Create or update a lead from an email enquiry.
   * Deduplicates by email address.
   */
  async createOrUpdateLeadFromEmail(
    context: {
      fromAddress: string;
      fromName: string;
      subject: string;
      bodyText: string;
      department: string | null;
      processedEmailId: number;
    },
    aiResult: AiAnalysisResult,
    matchedPropertyId: number | null
  ): Promise<LeadCreationResult> {
    // Check for existing lead by email
    const [existingLead] = await db.select()
      .from(leads)
      .where(ilike(leads.email, context.fromAddress.toLowerCase().trim()))
      .limit(1);

    if (existingLead) {
      // Update existing lead with new activity
      await this.updateExistingLead(existingLead.id, context, aiResult, matchedPropertyId);
      return { leadId: existingLead.id, isNew: false, status: existingLead.status };
    }

    // Create new lead
    const leadId = await this.createNewLead(context, aiResult, matchedPropertyId);
    return { leadId, isNew: true, status: 'new' };
  }

  /**
   * Create a new lead from email data
   */
  private async createNewLead(
    context: {
      fromAddress: string;
      fromName: string;
      subject: string;
      bodyText: string;
      department: string | null;
    },
    aiResult: AiAnalysisResult,
    matchedPropertyId: number | null
  ): Promise<number> {
    const leadDetails = aiResult.leadDetails;
    const phone = aiResult.extractedEntities?.phones?.[0] || null;

    // Determine lead type from AI or department
    let leadType = leadDetails?.leadType || 'rental';
    if (!leadDetails?.leadType) {
      if (context.department === 'sales') leadType = 'purchase';
      else if (context.department === 'lettings') leadType = 'rental';
    }

    // Parse budget if available
    let minBudget: number | null = null;
    let maxBudget: number | null = null;
    if (leadDetails?.budget) {
      const parsed = this.parseBudget(leadDetails.budget);
      maxBudget = parsed;
    }

    // Calculate initial lead score
    const score = this.calculateInitialScore(aiResult, !!matchedPropertyId);

    const leadData: any = {
      fullName: context.fromName || context.fromAddress.split('@')[0],
      email: context.fromAddress.toLowerCase().trim(),
      phone: phone || undefined,
      source: 'email',
      sourceDetail: context.department ? `${context.department}@ mailbox` : 'general email',
      leadType,
      preferredBedrooms: leadDetails?.bedrooms || undefined,
      preferredAreas: leadDetails?.areas && leadDetails.areas.length > 0 ? leadDetails.areas : undefined,
      minBudget: minBudget || undefined,
      maxBudget: maxBudget || undefined,
      moveInDate: leadDetails?.moveInDate ? new Date(leadDetails.moveInDate) : undefined,
      requirements: leadDetails?.requirements || undefined,
      status: 'new',
      priority: aiResult.priority === 'urgent' || aiResult.priority === 'high' ? 'hot' :
                aiResult.priority === 'normal' ? 'warm' : 'medium',
      score,
      notes: `Email enquiry: ${context.subject}\n\nAI Summary: ${aiResult.summary}`,
      lastActivityAt: new Date(),
    };

    const [lead] = await db.insert(leads).values(leadData).returning();

    console.log(`[LeadPipeline] Created lead ${lead.id}: ${lead.fullName} (${leadType})`);

    // Record property interest if matched
    if (matchedPropertyId) {
      await this.recordPropertyInterest(lead.id, matchedPropertyId, 'email_enquiry');
    }

    // Record communication
    await this.recordCommunication(lead.id, context);

    // Record activity
    await this.recordActivity(lead.id, 'lead_created', `Lead created from email: ${context.subject}`);

    return lead.id;
  }

  /**
   * Update an existing lead with new email activity
   */
  private async updateExistingLead(
    leadId: number,
    context: {
      fromAddress: string;
      fromName: string;
      subject: string;
      bodyText: string;
      department: string | null;
    },
    aiResult: AiAnalysisResult,
    matchedPropertyId: number | null
  ): Promise<void> {
    // Update last activity
    await db.update(leads)
      .set({
        lastActivityAt: new Date(),
        lastContactedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(leads.id, leadId));

    // Record property interest if matched
    if (matchedPropertyId) {
      await this.recordPropertyInterest(leadId, matchedPropertyId, 'email_enquiry');
    }

    // Record communication
    await this.recordCommunication(leadId, context);

    // Record activity
    await this.recordActivity(leadId, 'email_received', `Follow-up email: ${context.subject}`);

    console.log(`[LeadPipeline] Updated lead ${leadId} with new email activity`);
  }

  /**
   * Record a property interest for a lead
   */
  async recordPropertyInterest(
    leadId: number,
    propertyId: number,
    source: string
  ): Promise<void> {
    try {
      // Check if already recorded
      const [existing] = await db.select()
        .from(leadPropertyViews)
        .where(and(
          eq(leadPropertyViews.leadId, leadId),
          eq(leadPropertyViews.propertyId, propertyId)
        ))
        .limit(1);

      if (!existing) {
        await db.insert(leadPropertyViews).values({
          leadId,
          propertyId,
          viewedAt: new Date(),
          source,
        });
        console.log(`[LeadPipeline] Recorded property interest: lead ${leadId} → property ${propertyId}`);
      }
    } catch (error) {
      console.error(`[LeadPipeline] Failed to record property interest:`, error);
    }
  }

  /**
   * Record an inbound communication for a lead
   */
  private async recordCommunication(
    leadId: number,
    context: { fromAddress: string; fromName: string; subject: string; bodyText: string }
  ): Promise<void> {
    try {
      await db.insert(leadCommunications).values({
        leadId,
        type: 'email',
        direction: 'inbound',
        subject: context.subject,
        content: context.bodyText?.substring(0, 5000) || '',
        fromAddress: context.fromAddress,
        status: 'received',
      });
    } catch (error) {
      console.error(`[LeadPipeline] Failed to record communication:`, error);
    }
  }

  /**
   * Record a lead activity
   */
  private async recordActivity(
    leadId: number,
    activityType: string,
    description: string
  ): Promise<void> {
    try {
      await db.insert(leadActivities).values({
        leadId,
        activityType,
        description,
      });
    } catch (error) {
      console.error(`[LeadPipeline] Failed to record activity:`, error);
    }
  }

  /**
   * Progress a lead's status based on events
   */
  async progressLeadStatus(
    leadId: number,
    event: 'viewing_booked' | 'offer_made' | 'converted' | 'lost' | 'follow_up',
    details?: { lostReason?: string; propertyId?: number }
  ): Promise<void> {
    const statusMap: Record<string, string> = {
      viewing_booked: 'viewing_booked',
      offer_made: 'offer_made',
      converted: 'converted',
      lost: 'lost',
      follow_up: 'contacted', // At minimum, mark as contacted
    };

    const newStatus = statusMap[event];
    if (!newStatus) return;

    const updates: any = {
      status: newStatus,
      lastActivityAt: new Date(),
      updatedAt: new Date(),
    };

    if (event === 'lost' && details?.lostReason) {
      updates.lostReason = details.lostReason;
    }
    if (event === 'converted' && details?.propertyId) {
      updates.convertedAt = new Date();
      updates.convertedToPropertyId = details.propertyId;
    }

    await db.update(leads).set(updates).where(eq(leads.id, leadId));

    await this.recordActivity(leadId, event, `Lead status changed to ${newStatus}`);

    console.log(`[LeadPipeline] Lead ${leadId} progressed to ${newStatus}`);
  }

  /**
   * Calculate initial lead score based on AI analysis
   */
  private calculateInitialScore(aiResult: AiAnalysisResult, hasPropertyMatch: boolean): number {
    let score = 30; // Base score

    // Priority bonus
    if (aiResult.priority === 'urgent') score += 30;
    else if (aiResult.priority === 'high') score += 20;
    else if (aiResult.priority === 'normal') score += 10;

    // Viewing request is high intent
    if (aiResult.actionType === 'create_viewing') score += 20;

    // Has specific property = higher intent
    if (hasPropertyMatch) score += 15;

    // Has lead details = more engaged
    if (aiResult.leadDetails) {
      if (aiResult.leadDetails.budget) score += 5;
      if (aiResult.leadDetails.bedrooms) score += 5;
      if (aiResult.leadDetails.moveInDate) score += 10;
    }

    // Has phone number = easier to contact
    if (aiResult.extractedEntities?.phones?.length) score += 5;

    return Math.min(score, 100);
  }

  /**
   * Parse budget string to pence
   */
  private parseBudget(budget: string): number | null {
    if (!budget) return null;

    // Remove currency symbols and commas
    const cleaned = budget.replace(/[£$€,]/g, '').trim();

    // Try to extract number
    const match = cleaned.match(/[\d.]+/);
    if (!match) return null;

    let amount = parseFloat(match[0]);
    if (isNaN(amount)) return null;

    // Convert to pence
    // Detect if already in pence-like magnitude or pounds
    if (amount < 100000) {
      // Likely pounds — check if per month or total
      if (budget.toLowerCase().includes('/month') || budget.toLowerCase().includes('pcm') || budget.toLowerCase().includes('pw')) {
        amount = amount * 100; // Convert to pence
      } else {
        amount = amount * 100; // Convert to pence
      }
    }

    return Math.round(amount);
  }
}

export const leadPipelineService = new LeadPipelineService();
