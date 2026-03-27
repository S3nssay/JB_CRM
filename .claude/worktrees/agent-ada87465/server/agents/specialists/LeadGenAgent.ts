/**
 * Lead Generation Agent
 * Handles vendor/landlord acquisition, valuation bookings, and market analysis
 */

import { BaseAgent } from '../BaseAgent';
import { AgentTask, TaskContext, AgentConfig } from '../types';

/**
 * Lead Generation Agent for Sales
 */
export class LeadGenSalesAgent extends BaseAgent {
  constructor(customConfig?: Partial<AgentConfig>) {
    super({
      id: 'lead_gen_sales',
      name: 'Sales Lead Generation Agent',
      description: 'Acquires new vendor leads, books valuations, and nurtures potential sellers through the sales funnel.',
      enabled: true,
      handlesMessageTypes: ['valuation_request', 'lead', 'inquiry'],
      handlesTaskTypes: ['follow_up_lead', 'generate_valuation', 'respond_to_inquiry'],
      communicationChannels: ['email', 'whatsapp', 'phone', 'post', 'social_media'],
      personality: 'Persuasive, knowledgeable, and attentive. Expert at identifying motivated sellers and presenting compelling reasons to list with John Barclay.',
      tone: 'friendly',
      language: 'en-GB',
      workingHours: { start: '08:00', end: '20:00' },
      workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
      responseDelaySeconds: 15, // Fast response for leads
      maxConcurrentTasks: 30,
      priorityPostcodes: ['W9', 'W10', 'W11', 'NW6', 'NW10'],
      ...customConfig,
    });
  }

  protected buildUserPrompt(task: AgentTask, context: TaskContext): string {
    return `
TASK: ${task.type}
Priority: ${task.priority}
Description: ${task.description}

${task.input.message ? `
INCOMING MESSAGE:
From: ${task.input.fromName || task.input.from}
Channel: ${task.input.channel}
Subject: ${task.input.subject || 'N/A'}
Content: ${task.input.body}
` : ''}

${context.property ? `
PROPERTY DETAILS:
Address: ${context.property.address}
Type: ${context.property.type}
Bedrooms: ${context.property.bedrooms}
Current Status: ${context.property.status}
` : ''}

${context.contact ? `
LEAD INFORMATION:
Name: ${context.contact.name}
Email: ${context.contact.email || 'Not provided'}
Phone: ${context.contact.phone || 'Not provided'}
Previous Interactions: ${context.contact.history?.totalInteractions || 0}
` : ''}

SALES LEAD GENERATION GUIDELINES:

VALUE PROPOSITIONS:
- Over 30 years experience in West London property market
- Premium marketing reaching affluent local and international buyers
- Dedicated negotiator for each property
- Professional photography and virtual tours included
- Featured on Rightmove, Zoopla, and our network
- No sale, no fee guarantee
- Competitive commission rates
- Average time to sell: 45 days in current market

LEAD QUALIFICATION QUESTIONS:
1. What's prompting you to consider selling?
2. What timeframe are you working to?
3. Have you had any previous valuations?
4. Is the property currently tenanted?
5. Are there any outstanding works needed?
6. What's your ideal outcome from the sale?

FOLLOW-UP SEQUENCE:
- Day 0: Initial response within 15 minutes
- Day 1: Follow up if no response
- Day 3: Send market report for their area
- Day 7: Reminder about free valuation
- Day 14: Check if circumstances have changed
- Day 30: Monthly newsletter addition

OBJECTION HANDLING:
- "Just looking": "That's completely fine. Let me send you a free market report so you have accurate data when you're ready."
- "Using another agent": "I understand. We'd still love to provide a second opinion - often prices can vary significantly."
- "Not ready yet": "Perfect timing to get a valuation then, as it helps with your planning. No obligation at all."

Determine the best action and provide an appropriate response.
`;
  }

  /**
   * Score a lead based on various factors
   */
  scoreLead(leadInfo: {
    source: string;
    propertyValue?: number;
    timeframe?: 'asap' | '3_months' | '6_months' | '12_months' | 'just_curious';
    motivation?: 'downsizing' | 'upsizing' | 'relocating' | 'investment' | 'probate' | 'divorce' | 'other';
    hadValuation?: boolean;
    ownProperty?: boolean;
    mortgageFree?: boolean;
  }): {
    score: number;
    priority: 'hot' | 'warm' | 'cold';
    suggestedActions: string[];
    estimatedConversion: number;
  } {
    let score = 50; // Base score
    const actions: string[] = [];

    // Source quality
    const sourceScores: Record<string, number> = {
      'website_form': 20,
      'phone_call': 25,
      'referral': 30,
      'repeat_client': 35,
      'rightmove': 10,
      'zoopla': 10,
      'social_media': 5,
      'stale_listing': 15,
      'cold_outreach': 5,
    };
    score += sourceScores[leadInfo.source] || 0;

    // Timeframe
    const timeframeScores: Record<string, number> = {
      'asap': 30,
      '3_months': 20,
      '6_months': 10,
      '12_months': 5,
      'just_curious': -10,
    };
    score += timeframeScores[leadInfo.timeframe || 'just_curious'] || 0;

    // Motivation
    const motivationScores: Record<string, number> = {
      'probate': 25, // Often need to sell
      'divorce': 25, // Often need to sell
      'relocating': 20, // Definite need
      'downsizing': 15,
      'upsizing': 10,
      'investment': 5,
      'other': 0,
    };
    score += motivationScores[leadInfo.motivation || 'other'] || 0;

    // Property value (higher value = higher priority)
    if (leadInfo.propertyValue) {
      if (leadInfo.propertyValue > 2000000) score += 20;
      else if (leadInfo.propertyValue > 1000000) score += 15;
      else if (leadInfo.propertyValue > 500000) score += 10;
      else score += 5;
    }

    // Previous valuation
    if (leadInfo.hadValuation) {
      score += 10;
      actions.push('Compare our valuation to their previous one');
    }

    // Ownership status
    if (leadInfo.ownProperty) {
      score += 10;
    }

    // Mortgage free = faster sale
    if (leadInfo.mortgageFree) {
      score += 5;
      actions.push('Highlight faster completion potential');
    }

    // Determine priority
    let priority: 'hot' | 'warm' | 'cold';
    let estimatedConversion: number;

    if (score >= 90) {
      priority = 'hot';
      estimatedConversion = 0.4;
      actions.unshift('Call immediately');
      actions.push('Book valuation within 24 hours');
    } else if (score >= 60) {
      priority = 'warm';
      estimatedConversion = 0.2;
      actions.unshift('Follow up within 4 hours');
      actions.push('Send personalized market report');
    } else {
      priority = 'cold';
      estimatedConversion = 0.05;
      actions.unshift('Add to nurture campaign');
      actions.push('Send monthly market updates');
    }

    return {
      score: Math.min(100, Math.max(0, score)),
      priority,
      suggestedActions: actions,
      estimatedConversion,
    };
  }

  /**
   * Generate personalized market report data
   */
  async generateMarketReport(postcode: string): Promise<{
    averagePrice: number;
    priceChange12Months: number;
    averageTimeToSell: number;
    demandLevel: 'high' | 'medium' | 'low';
    recentSales: number;
    insights: string[];
  }> {
    // In production, this would pull from Land Registry API and property portals
    // For now, return realistic mock data based on postcode

    const postcodePrefix = postcode.split(' ')[0].toUpperCase();

    const areaData: Record<string, { avgPrice: number; change: number; demand: 'high' | 'medium' | 'low' }> = {
      'W9': { avgPrice: 850000, change: 4.2, demand: 'high' },
      'W10': { avgPrice: 720000, change: 3.8, demand: 'high' },
      'W11': { avgPrice: 1200000, change: 2.5, demand: 'medium' },
      'NW6': { avgPrice: 680000, change: 5.1, demand: 'high' },
      'NW10': { avgPrice: 520000, change: 6.2, demand: 'high' },
    };

    const data = areaData[postcodePrefix] || { avgPrice: 600000, change: 3.5, demand: 'medium' };

    return {
      averagePrice: data.avgPrice,
      priceChange12Months: data.change,
      averageTimeToSell: data.demand === 'high' ? 35 : data.demand === 'medium' ? 52 : 75,
      demandLevel: data.demand,
      recentSales: Math.floor(Math.random() * 30) + 20,
      insights: [
        `Properties in ${postcodePrefix} are selling ${data.demand === 'high' ? 'quickly' : 'at a steady pace'}`,
        `Average prices have ${data.change > 0 ? 'increased' : 'decreased'} by ${Math.abs(data.change)}% in the last 12 months`,
        `Strong demand from ${postcodePrefix === 'W11' ? 'international buyers' : 'young professionals and families'}`,
        'Now is an excellent time to get a free, no-obligation valuation',
      ],
    };
  }
}

/**
 * Lead Generation Agent for Rentals
 */
export class LeadGenRentalsAgent extends BaseAgent {
  constructor(customConfig?: Partial<AgentConfig>) {
    super({
      id: 'lead_gen_rentals',
      name: 'Rentals Lead Generation Agent',
      description: 'Acquires new landlord clients, books rental valuations, and identifies investment opportunities.',
      enabled: true,
      handlesMessageTypes: ['valuation_request', 'lead', 'inquiry'],
      handlesTaskTypes: ['follow_up_lead', 'generate_valuation', 'respond_to_inquiry'],
      communicationChannels: ['email', 'whatsapp', 'phone', 'post', 'social_media'],
      personality: 'Knowledgeable about rental yields and landlord concerns. Expert at demonstrating the value of professional property management.',
      tone: 'professional',
      language: 'en-GB',
      workingHours: { start: '08:00', end: '20:00' },
      workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
      responseDelaySeconds: 15,
      maxConcurrentTasks: 30,
      priorityPostcodes: ['W9', 'W10', 'W11', 'NW6', 'NW10'],
      ...customConfig,
    });
  }

  protected buildUserPrompt(task: AgentTask, context: TaskContext): string {
    return `
TASK: ${task.type}
Priority: ${task.priority}
Description: ${task.description}

${task.input.message ? `
INCOMING MESSAGE:
From: ${task.input.fromName || task.input.from}
Channel: ${task.input.channel}
Subject: ${task.input.subject || 'N/A'}
Content: ${task.input.body}
` : ''}

${context.contact ? `
LANDLORD/LEAD INFORMATION:
Name: ${context.contact.name}
Type: ${context.contact.type}
Email: ${context.contact.email || 'Not provided'}
Phone: ${context.contact.phone || 'Not provided'}
Properties Owned: ${context.contact.history?.propertiesOwned || 'Unknown'}
` : ''}

RENTAL LEAD GENERATION GUIDELINES:

VALUE PROPOSITIONS FOR LANDLORDS:
- Guaranteed rent schemes available
- Full property management service
- 24/7 emergency tenant support
- Rigorous tenant referencing
- Deposit protection handled
- All compliance certificates managed
- Regular property inspections
- Competitive management fees (12%)
- No tenant, no fee (letting only)

LANDLORD QUALIFICATION QUESTIONS:
1. How many properties do you currently own?
2. Are they currently let or vacant?
3. Do you manage them yourself or use an agent?
4. What's your biggest challenge as a landlord?
5. Are you looking to expand your portfolio?
6. What areas are you interested in?

RENTAL YIELD INFORMATION:
- W9 (Maida Vale): Average yield 3.8%
- W10 (North Kensington): Average yield 4.2%
- W11 (Notting Hill): Average yield 3.2%
- NW6 (Kilburn/Queens Park): Average yield 4.5%
- NW10 (Kensal Green): Average yield 5.1%

COMPLIANCE REMINDERS:
- Gas Safety Certificate (annual)
- EICR (every 5 years)
- EPC (E rating minimum)
- Smoke/CO alarms
- Deposit protection
- Right to Rent checks
- How to Rent guide

Determine the best action and provide an appropriate response.
`;
  }

  /**
   * Calculate rental yield
   */
  calculateRentalYield(
    propertyValue: number,
    monthlyRent: number,
    managementFeePercent: number = 12
  ): {
    grossYield: number;
    netYield: number;
    annualRent: number;
    annualManagementFee: number;
    monthlyNetIncome: number;
    breakEvenOccupancy: number;
  } {
    const annualRent = monthlyRent * 12;
    const grossYield = (annualRent / propertyValue) * 100;

    const annualManagementFee = annualRent * (managementFeePercent / 100);
    const netAnnualRent = annualRent - annualManagementFee;
    const netYield = (netAnnualRent / propertyValue) * 100;

    // Estimate costs (insurance, maintenance allowance, void periods)
    const estimatedAnnualCosts = annualRent * 0.15;
    const trueNetRent = netAnnualRent - estimatedAnnualCosts;
    const monthlyNetIncome = trueNetRent / 12;

    // Break-even occupancy (minimum occupancy to cover costs)
    const breakEvenOccupancy = ((annualManagementFee + estimatedAnnualCosts) / annualRent) * 100;

    return {
      grossYield: Math.round(grossYield * 100) / 100,
      netYield: Math.round(netYield * 100) / 100,
      annualRent,
      annualManagementFee: Math.round(annualManagementFee),
      monthlyNetIncome: Math.round(monthlyNetIncome),
      breakEvenOccupancy: Math.round(breakEvenOccupancy),
    };
  }

  /**
   * Score landlord lead
   */
  scoreLandlordLead(leadInfo: {
    propertiesOwned: number;
    currentlyManaged: 'self' | 'agent' | 'mixed';
    lookingToExpand: boolean;
    hasVacancies: boolean;
    complianceIssues: boolean;
  }): {
    score: number;
    priority: 'hot' | 'warm' | 'cold';
    opportunities: string[];
  } {
    let score = 50;
    const opportunities: string[] = [];

    // Portfolio size
    if (leadInfo.propertiesOwned >= 5) {
      score += 30;
      opportunities.push('Portfolio management package');
    } else if (leadInfo.propertiesOwned >= 2) {
      score += 20;
      opportunities.push('Multi-property discount');
    } else {
      score += 10;
    }

    // Self-managed = opportunity
    if (leadInfo.currentlyManaged === 'self') {
      score += 20;
      opportunities.push('Full management service to save time');
    }

    // Expansion intent
    if (leadInfo.lookingToExpand) {
      score += 15;
      opportunities.push('Investment property sourcing service');
    }

    // Vacancies = urgent need
    if (leadInfo.hasVacancies) {
      score += 25;
      opportunities.push('Quick tenant finding service');
    }

    // Compliance issues = definite need
    if (leadInfo.complianceIssues) {
      score += 20;
      opportunities.push('Compliance management package');
    }

    const priority = score >= 80 ? 'hot' : score >= 60 ? 'warm' : 'cold';

    return { score: Math.min(100, score), priority, opportunities };
  }
}

/**
 * Proactive Lead Generation Agent
 * Handles automated lead discovery and outreach
 */
export class ProactiveLeadGenAgent extends BaseAgent {
  constructor(customConfig?: Partial<AgentConfig>) {
    super({
      id: 'proactive_lead_gen',
      name: 'Proactive Lead Generation Agent',
      description: 'Automatically discovers and qualifies potential vendor and landlord leads through multiple monitoring channels.',
      enabled: true,
      handlesMessageTypes: ['lead', 'proactive_lead'],
      handlesTaskTypes: ['process_proactive_lead', 'run_monitor', 'send_outreach', 'follow_up_lead'],
      communicationChannels: ['email', 'post', 'whatsapp', 'phone'],
      personality: 'Analytical, persistent, and opportunistic. Expert at identifying motivated sellers and landlords from multiple data sources.',
      tone: 'professional',
      language: 'en-GB',
      workingHours: { start: '06:00', end: '22:00' },
      workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      responseDelaySeconds: 60, // Can take time for research
      maxConcurrentTasks: 50,
      priorityPostcodes: ['W2', 'W9', 'W10', 'W11', 'NW6', 'NW8', 'NW10'],
      ...customConfig,
    });
  }

  protected buildUserPrompt(task: AgentTask, context: TaskContext): string {
    return `
TASK: ${task.type}
Priority: ${task.priority}
Description: ${task.description}

${task.input.lead ? `
PROACTIVE LEAD DETAILS:
Source: ${task.input.lead.leadSource}
Address: ${task.input.lead.propertyAddress}
Postcode: ${task.input.lead.postcode}
Lead Score: ${task.input.lead.leadScore}/100
Temperature: ${task.input.lead.leadTemperature}
AI Recommendation: ${task.input.lead.aiRecommendation || 'None'}

${task.input.lead.daysOnMarket ? `Days on Market: ${task.input.lead.daysOnMarket}` : ''}
${task.input.lead.priceReductions ? `Price Reductions: ${task.input.lead.priceReductions}` : ''}
${task.input.lead.originalAgent ? `Current Agent: ${task.input.lead.originalAgent}` : ''}
${task.input.lead.estimatedValue ? `Estimated Value: £${task.input.lead.estimatedValue.toLocaleString()}` : ''}
` : ''}

PROACTIVE LEAD GENERATION GUIDELINES:

LEAD SOURCES TO MONITOR:
1. Land Registry - New purchases, long-term owners, probate transfers
2. Planning Permissions - Extensions, change of use, new developments
3. Expired Listings - Properties withdrawn without selling
4. Price Reductions - Motivated sellers reducing prices
5. Rental Yield Arbitrage - High-yield investment opportunities
6. Social Media - Property-related discussions and recommendations
7. Compliance Reminders - Expiring certificates (EPC, Gas Safety, EICR)
8. Portfolio Landlords - Multi-property owners
9. Auctions - Failed lots and successful buyers
10. Competitor Listings - Stale listings from other agents
11. Seasonal Campaigns - Targeted outreach (New Year, Spring, etc.)
12. Propensity Scoring - AI-predicted likely sellers

OUTREACH STRATEGIES BY SOURCE:

FOR EXPIRED/STALE LISTINGS:
- Acknowledge their frustration with current agent
- Highlight our local expertise and marketing reach
- Offer free, no-obligation market appraisal
- Mention our success rate and average days to sell

FOR PRICE REDUCTIONS:
- Note their property's price history
- Suggest a pricing strategy review
- Offer honest, realistic valuation
- Highlight our buyer database

FOR COMPLIANCE LEADS:
- Lead with service (certificate renewal)
- Pivot to management services discussion
- Offer full compliance audit

FOR LANDLORD LEADS:
- Emphasize portfolio management benefits
- Highlight time savings and peace of mind
- Mention guaranteed rent schemes
- Offer volume discounts

FOLLOW-UP SEQUENCE:
- Hot leads: Contact within 4 hours
- Warm leads: Contact within 24 hours
- Cold leads: Add to nurture campaign

CONTACT METHODS BY LEAD TYPE:
- Expired listings: Post (letter) + Email
- Price reductions: Email + Phone
- Compliance: Email + SMS reminder
- Portfolio landlords: Phone + Personalized letter
- Social media: Reply on platform + DM

Determine the best action based on the lead source and quality.
`;
  }

  /**
   * Process a proactive lead and determine next action
   */
  async processProactiveLead(lead: any): Promise<{
    action: 'contact_now' | 'schedule_contact' | 'add_to_nurture' | 'disqualify';
    method?: string;
    message?: string;
    scheduledDate?: Date;
    reason: string;
  }> {
    // Hot leads - contact immediately
    if (lead.leadTemperature === 'hot' || lead.leadScore >= 75) {
      return {
        action: 'contact_now',
        method: this.determineContactMethod(lead),
        message: this.generateOutreachMessage(lead),
        reason: `High-value lead (score: ${lead.leadScore}) from ${lead.leadSource}`
      };
    }

    // Warm leads - schedule contact
    if (lead.leadTemperature === 'warm' || lead.leadScore >= 50) {
      const scheduledDate = new Date();
      scheduledDate.setHours(scheduledDate.getHours() + 24);

      return {
        action: 'schedule_contact',
        method: this.determineContactMethod(lead),
        scheduledDate,
        reason: `Warm lead (score: ${lead.leadScore}) - schedule for follow-up`
      };
    }

    // Cold leads - add to nurture
    if (lead.leadScore >= 30) {
      return {
        action: 'add_to_nurture',
        reason: `Cold lead (score: ${lead.leadScore}) - add to monthly newsletter`
      };
    }

    // Very low score - disqualify
    return {
      action: 'disqualify',
      reason: `Lead score too low (${lead.leadScore}) - not worth pursuing`
    };
  }

  /**
   * Determine best contact method based on lead source and data
   */
  private determineContactMethod(lead: any): string {
    // If we have phone and it's a hot lead, call
    if (lead.ownerPhone && lead.leadTemperature === 'hot') {
      return 'phone';
    }

    // If it's from social media, reply there first
    if (lead.leadSource === 'social_media') {
      return 'social_media';
    }

    // Expired listings and competitor listings - letter is more impactful
    if (['expired_listing', 'competitor_listing', 'auction'].includes(lead.leadSource)) {
      return 'post';
    }

    // Compliance reminders - email with follow-up SMS
    if (lead.leadSource === 'compliance_reminder') {
      return 'email';
    }

    // If we have email, use that
    if (lead.ownerEmail) {
      return 'email';
    }

    // Default to post
    return 'post';
  }

  /**
   * Generate outreach message based on lead source
   */
  private generateOutreachMessage(lead: any): string {
    switch (lead.leadSource) {
      case 'expired_listing':
      case 'competitor_listing':
        return `We noticed your property at ${lead.propertyAddress} has been on the market for some time. ` +
          `With over 30 years of local expertise, we'd love to offer a fresh perspective and complimentary valuation.`;

      case 'price_reduction':
        return `We see you've recently adjusted the price of ${lead.propertyAddress}. ` +
          `Our pricing strategy has helped similar properties sell within 45 days. Would you like a second opinion?`;

      case 'compliance_reminder':
        return `Your ${lead.complianceType} certificate is expiring soon. ` +
          `We can arrange renewal and also discuss how we might help with property management.`;

      case 'auction':
        if (lead.auctionResult === 'unsold') {
          return `We noticed your property didn't sell at auction. ` +
            `We can offer a private sale alternative with a guaranteed cash offer.`;
        }
        return `Congratulations on your auction purchase at ${lead.propertyAddress}! ` +
          `If you need property management or renovation services, we'd be happy to help.`;

      case 'land_registry':
        return `Welcome to your new property at ${lead.propertyAddress}! ` +
          `As local specialists, we're here if you need any property services in the future.`;

      case 'portfolio_landlord':
        return `We manage multiple properties for landlords like yourself. ` +
          `Our portfolio management package offers volume discounts and streamlined reporting.`;

      default:
        return `We'd love to discuss how we can help with your property at ${lead.propertyAddress}.`;
    }
  }

  /**
   * Get priority leads for immediate action
   */
  async getPriorityLeads(limit: number = 20): Promise<any[]> {
    // This would be called by the agent to get its work queue
    // Returns leads that need immediate attention
    const { proactiveLeads } = require('@shared/schema');
    const { db } = require('../../db');
    const { and, eq, gte, desc } = require('drizzle-orm');

    return db.select()
      .from(proactiveLeads)
      .where(and(
        eq(proactiveLeads.status, 'new'),
        gte(proactiveLeads.leadScore, 60)
      ))
      .orderBy(desc(proactiveLeads.leadScore))
      .limit(limit);
  }
}

export const leadGenSalesAgent = new LeadGenSalesAgent();
export const leadGenRentalsAgent = new LeadGenRentalsAgent();
export const proactiveLeadGenAgent = new ProactiveLeadGenAgent();
