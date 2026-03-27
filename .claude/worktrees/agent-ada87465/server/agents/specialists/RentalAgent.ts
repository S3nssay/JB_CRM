/**
 * Rental Agent
 * Handles tenant matching, viewing scheduling, and tenancy management
 */

import { BaseAgent } from '../BaseAgent';
import { AgentTask, TaskContext, AgentConfig } from '../types';

export class RentalAgent extends BaseAgent {
  constructor(customConfig?: Partial<AgentConfig>) {
    super({
      id: 'rental',
      name: 'Rental Agent',
      description: 'Specialist in lettings across West London. Handles tenant enquiries, viewing arrangements, tenancy applications, and ongoing tenant relations.',
      enabled: true,
      handlesMessageTypes: ['inquiry', 'viewing_request', 'contract_request'],
      handlesTaskTypes: ['respond_to_inquiry', 'schedule_viewing', 'send_contract', 'follow_up_lead'],
      communicationChannels: ['email', 'whatsapp', 'phone'],
      personality: 'Helpful, efficient, and thorough. Expert in tenant-landlord relations and lettings regulations. Committed to finding the perfect match between tenants and properties.',
      tone: 'friendly',
      language: 'en-GB',
      workingHours: { start: '09:00', end: '18:00' },
      workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
      responseDelaySeconds: 30,
      maxConcurrentTasks: 15,
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
Monthly Rent: £${context.property.price.toLocaleString()} pcm
Status: ${context.property.status}
` : ''}

${context.contact ? `
TENANT/APPLICANT INFORMATION:
Name: ${context.contact.name}
Type: ${context.contact.type}
Email: ${context.contact.email || 'Not provided'}
Phone: ${context.contact.phone || 'Not provided'}
Previous Interactions: ${context.contact.history?.totalInteractions || 0}
` : ''}

RENTAL AGENT GUIDELINES:
1. For viewing requests: Check availability, confirm tenant's requirements match property
2. For applications: Explain referencing process, deposit requirements, and move-in timeline
3. Always mention: EPC rating, council tax band, utility arrangements
4. Emphasize our comprehensive property management service
5. For existing tenants: Be responsive to queries and concerns
6. Ensure compliance with AST regulations, deposit protection, and Right to Rent

Key Information to Include:
- Deposit: Usually 5 weeks' rent (capped by Tenant Fees Act 2019)
- Referencing: Credit check, employment verification, landlord references
- Right to Rent: All tenants must provide proof of right to rent in UK
- Minimum tenancy: Typically 6-12 months AST

Determine the best action and provide an appropriate response.
`;
  }

  /**
   * Match tenants to available properties based on requirements
   */
  matchTenantToProperties(
    tenantRequirements: {
      maxRent: number;
      minBedrooms: number;
      preferredAreas: string[];
      petFriendly?: boolean;
      parkingRequired?: boolean;
      gardenRequired?: boolean;
    },
    availableProperties: Array<{
      id: number;
      address: string;
      postcode: string;
      bedrooms: number;
      rent: number;
      allowsPets?: boolean;
      hasParking?: boolean;
      hasGarden?: boolean;
    }>
  ): Array<{
    property: typeof availableProperties[0];
    matchScore: number;
    matchReasons: string[];
  }> {
    const matches = availableProperties
      .map(property => {
        let score = 0;
        const reasons: string[] = [];

        // Must meet minimum bedrooms
        if (property.bedrooms >= tenantRequirements.minBedrooms) {
          score += 30;
          reasons.push(`${property.bedrooms} bedrooms meets requirement`);
        } else {
          return null; // Disqualify
        }

        // Must be within budget
        if (property.rent <= tenantRequirements.maxRent) {
          score += 30;
          const savingsPercent = ((tenantRequirements.maxRent - property.rent) / tenantRequirements.maxRent * 100).toFixed(0);
          reasons.push(`£${property.rent} pcm (${savingsPercent}% under budget)`);
        } else {
          return null; // Disqualify
        }

        // Preferred area bonus
        const postcodePrefix = property.postcode.split(' ')[0];
        if (tenantRequirements.preferredAreas.some(area =>
          postcodePrefix.toLowerCase().includes(area.toLowerCase()) ||
          area.toLowerCase().includes(postcodePrefix.toLowerCase())
        )) {
          score += 20;
          reasons.push('In preferred area');
        }

        // Pet friendly
        if (tenantRequirements.petFriendly) {
          if (property.allowsPets) {
            score += 10;
            reasons.push('Pet friendly');
          } else {
            score -= 20; // Penalty but don't disqualify
          }
        }

        // Parking
        if (tenantRequirements.parkingRequired && property.hasParking) {
          score += 5;
          reasons.push('Parking available');
        }

        // Garden
        if (tenantRequirements.gardenRequired && property.hasGarden) {
          score += 5;
          reasons.push('Garden included');
        }

        return { property, matchScore: score, matchReasons: reasons };
      })
      .filter(Boolean) as Array<{
        property: typeof availableProperties[0];
        matchScore: number;
        matchReasons: string[];
      }>;

    // Sort by match score descending
    return matches.sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * Calculate tenancy costs breakdown
   */
  calculateTenancyCosts(monthlyRent: number, tenancyLengthMonths: number = 12): {
    monthlyRent: number;
    deposit: number;
    firstMonthRent: number;
    totalMoveInCost: number;
    annualCost: number;
    notes: string[];
  } {
    // Deposit capped at 5 weeks' rent (Tenant Fees Act 2019)
    const weeklyRent = (monthlyRent * 12) / 52;
    const deposit = Math.round(weeklyRent * 5);

    return {
      monthlyRent,
      deposit,
      firstMonthRent: monthlyRent,
      totalMoveInCost: deposit + monthlyRent,
      annualCost: monthlyRent * tenancyLengthMonths,
      notes: [
        'Deposit will be protected in a government-approved scheme',
        'First month\'s rent due before move-in',
        'No additional fees (Tenant Fees Act 2019)',
        'Referencing included at no extra cost',
      ],
    };
  }

  /**
   * Generate viewing schedule
   */
  suggestViewingSlots(
    propertyAvailability: { date: Date; slots: string[] }[],
    tenantPreferences?: { preferredDays?: string[]; preferredTimes?: string[] }
  ): { date: string; time: string; score: number }[] {
    const suggestions: { date: string; time: string; score: number }[] = [];

    for (const day of propertyAvailability) {
      for (const slot of day.slots) {
        let score = 50;

        // Check if matches tenant preferences
        const dayName = day.date.toLocaleDateString('en-GB', { weekday: 'long' }).toLowerCase();
        if (tenantPreferences?.preferredDays?.some(d => d.toLowerCase() === dayName)) {
          score += 30;
        }

        // Check time preference
        const hour = parseInt(slot.split(':')[0]);
        if (tenantPreferences?.preferredTimes?.includes('morning') && hour < 12) {
          score += 20;
        } else if (tenantPreferences?.preferredTimes?.includes('afternoon') && hour >= 12 && hour < 17) {
          score += 20;
        } else if (tenantPreferences?.preferredTimes?.includes('evening') && hour >= 17) {
          score += 20;
        }

        suggestions.push({
          date: day.date.toLocaleDateString('en-GB'),
          time: slot,
          score,
        });
      }
    }

    return suggestions.sort((a, b) => b.score - a.score).slice(0, 6);
  }
}

export const rentalAgent = new RentalAgent();
