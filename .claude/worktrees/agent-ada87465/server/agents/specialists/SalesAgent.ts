/**
 * Sales Agent
 * Handles property sales, valuations, buyer enquiries, and offer negotiations
 */

import { BaseAgent } from '../BaseAgent';
import { AgentTask, TaskContext, AgentConfig } from '../types';

export class SalesAgent extends BaseAgent {
  constructor(customConfig?: Partial<AgentConfig>) {
    super({
      id: 'sales',
      name: 'Sales Agent',
      description: 'Expert in property sales across West London. Handles buyer enquiries, property valuations, offer negotiations, and sales progression.',
      enabled: true,
      handlesMessageTypes: ['inquiry', 'viewing_request', 'offer', 'valuation_request'],
      handlesTaskTypes: ['respond_to_inquiry', 'schedule_viewing', 'process_offer', 'generate_valuation', 'follow_up_lead'],
      communicationChannels: ['email', 'whatsapp', 'phone'],
      personality: 'Knowledgeable, persuasive, and attentive. Deep understanding of the West London property market. Always focused on achieving the best outcome for both buyers and sellers.',
      tone: 'professional',
      language: 'en-GB',
      workingHours: { start: '09:00', end: '18:00' },
      workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
      responseDelaySeconds: 30,
      maxConcurrentTasks: 10,
      priorityPostcodes: ['W9', 'W10', 'W11', 'NW6', 'NW10'],
      ...customConfig,
    });
  }

  protected buildUserPrompt(task: AgentTask, context: TaskContext): string {
    const basePrompt = `
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
Price: £${context.property.price.toLocaleString()}
Status: ${context.property.status}
` : ''}

${context.contact ? `
CONTACT INFORMATION:
Name: ${context.contact.name}
Type: ${context.contact.type}
Email: ${context.contact.email || 'Not provided'}
Phone: ${context.contact.phone || 'Not provided'}
Previous Interactions: ${context.contact.history?.totalInteractions || 0}
${context.contact.history?.viewingsAttended ? `Viewings Attended: ${context.contact.history.viewingsAttended}` : ''}
${context.contact.history?.offersSubmitted ? `Offers Submitted: ${context.contact.history.offersSubmitted}` : ''}
` : ''}

${context.conversationHistory?.length ? `
CONVERSATION HISTORY:
${context.conversationHistory.slice(-5).map(m => `[${m.role}] ${m.content}`).join('\n')}
` : ''}

SALES AGENT GUIDELINES:
1. For viewing requests: Check availability, suggest times, and provide property highlights
2. For offers: Acknowledge receipt, assess against asking price, prepare to negotiate
3. For valuations: Request property details, schedule appointment, explain our process
4. Always highlight John Barclay's premium service and local market expertise
5. Use comparable sales data when discussing prices
6. Be responsive to buyer/seller needs while protecting all parties' interests

Determine the best action and provide an appropriate response.
`;

    return basePrompt;
  }

  /**
   * Calculate a preliminary valuation based on property details
   */
  async generatePreliminaryValuation(propertyDetails: {
    postcode: string;
    type: string;
    bedrooms: number;
    condition: string;
    hasGarden?: boolean;
    hasParking?: boolean;
  }): Promise<{
    lowEstimate: number;
    midEstimate: number;
    highEstimate: number;
    confidence: number;
    factors: string[];
  }> {
    // Base prices per sqft by postcode area (simplified)
    const basePricesPerBed: Record<string, number> = {
      'W9': 250000,   // Maida Vale
      'W10': 220000,  // North Kensington
      'W11': 280000,  // Notting Hill
      'NW6': 200000,  // Kilburn/Queens Park
      'NW10': 180000, // Kensal Green/Willesden
    };

    const postcodePrefix = propertyDetails.postcode.split(' ')[0].toUpperCase();
    const basePrice = basePricesPerBed[postcodePrefix] || 200000;

    let midEstimate = basePrice * propertyDetails.bedrooms;
    const factors: string[] = [];

    // Adjust for property type
    if (propertyDetails.type.toLowerCase().includes('house')) {
      midEstimate *= 1.3;
      factors.push('+30% for house vs flat');
    } else if (propertyDetails.type.toLowerCase().includes('penthouse')) {
      midEstimate *= 1.5;
      factors.push('+50% for penthouse');
    }

    // Adjust for condition
    if (propertyDetails.condition === 'excellent') {
      midEstimate *= 1.1;
      factors.push('+10% for excellent condition');
    } else if (propertyDetails.condition === 'needs_work') {
      midEstimate *= 0.85;
      factors.push('-15% for property needing work');
    }

    // Additional features
    if (propertyDetails.hasGarden) {
      midEstimate *= 1.08;
      factors.push('+8% for garden');
    }
    if (propertyDetails.hasParking) {
      midEstimate *= 1.05;
      factors.push('+5% for parking');
    }

    return {
      lowEstimate: Math.round(midEstimate * 0.92),
      midEstimate: Math.round(midEstimate),
      highEstimate: Math.round(midEstimate * 1.08),
      confidence: 0.7,
      factors,
    };
  }

  /**
   * Assess an offer against asking price
   */
  assessOffer(
    askingPrice: number,
    offerPrice: number,
    marketConditions: 'hot' | 'normal' | 'slow' = 'normal'
  ): {
    recommendation: 'accept' | 'counter' | 'reject' | 'consider';
    reasoning: string;
    suggestedCounter?: number;
  } {
    const percentageOfAsking = (offerPrice / askingPrice) * 100;

    const thresholds = {
      hot: { accept: 98, consider: 95, counter: 90 },
      normal: { accept: 95, consider: 92, counter: 85 },
      slow: { accept: 92, consider: 88, counter: 80 },
    };

    const threshold = thresholds[marketConditions];

    if (percentageOfAsking >= threshold.accept) {
      return {
        recommendation: 'accept',
        reasoning: `Offer at ${percentageOfAsking.toFixed(1)}% of asking price is strong in current market conditions.`,
      };
    } else if (percentageOfAsking >= threshold.consider) {
      return {
        recommendation: 'consider',
        reasoning: `Offer at ${percentageOfAsking.toFixed(1)}% is reasonable but may be worth countering for a better price.`,
        suggestedCounter: Math.round(askingPrice * (threshold.accept / 100)),
      };
    } else if (percentageOfAsking >= threshold.counter) {
      return {
        recommendation: 'counter',
        reasoning: `Offer at ${percentageOfAsking.toFixed(1)}% is below market expectations. Counter offer recommended.`,
        suggestedCounter: Math.round(askingPrice * ((threshold.consider + threshold.accept) / 200)),
      };
    } else {
      return {
        recommendation: 'reject',
        reasoning: `Offer at ${percentageOfAsking.toFixed(1)}% is significantly below market value and unlikely to reach acceptable terms.`,
      };
    }
  }
}

export const salesAgent = new SalesAgent();
