/**
 * Maintenance Agent
 * Handles maintenance tickets, contractor dispatch, and property inspections
 */

import { BaseAgent } from '../BaseAgent';
import { AgentTask, TaskContext, AgentConfig } from '../types';

export class MaintenanceAgent extends BaseAgent {
  constructor(customConfig?: Partial<AgentConfig>) {
    super({
      id: 'maintenance',
      name: 'Property Maintenance Agent',
      description: 'Manages all property maintenance issues. Handles repair requests, coordinates contractors, and ensures timely resolution of property problems.',
      enabled: true,
      handlesMessageTypes: ['maintenance_request', 'complaint'],
      handlesTaskTypes: ['create_maintenance_ticket', 'dispatch_contractor', 'respond_to_inquiry', 'follow_up_lead'],
      communicationChannels: ['email', 'whatsapp', 'sms', 'phone'],
      personality: 'Responsive, practical, and solution-oriented. Understands the urgency of property issues and works efficiently to resolve them.',
      tone: 'professional',
      language: 'en-GB',
      workingHours: { start: '08:00', end: '20:00' },
      workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      responseDelaySeconds: 15, // Quick response for maintenance
      maxConcurrentTasks: 20,
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
Status: ${context.property.status}
` : ''}

${context.contact ? `
REPORTER INFORMATION:
Name: ${context.contact.name}
Type: ${context.contact.type} (tenant/landlord)
Contact: ${context.contact.email || context.contact.phone || 'Not provided'}
` : ''}

MAINTENANCE AGENT GUIDELINES:

PRIORITY ASSESSMENT:
- EMERGENCY (respond within 1 hour): Gas leak, no heating in winter, flooding, security breach, fire damage
- URGENT (respond within 4 hours): No hot water, broken lock, electrical fault, sewage issues
- HIGH (respond within 24 hours): Broken appliance affecting daily life, roof leak, pest infestation
- MEDIUM (respond within 48 hours): Minor leaks, appliance issues, general repairs
- LOW (respond within 5 days): Cosmetic issues, minor improvements, non-urgent repairs

RESPONSE CHECKLIST:
1. Acknowledge the issue and express understanding
2. Ask clarifying questions if needed (location, when started, severity)
3. Assign priority level based on issue type
4. Explain next steps and expected timeline
5. For emergencies: provide emergency contractor contact immediately
6. Document everything for landlord reporting

CONTRACTOR CATEGORIES:
- Plumbing & Heating: Leaks, boiler issues, radiators, hot water
- Electrical: Power outages, socket issues, lighting, rewiring
- Gas Safe Engineers: Boiler servicing, gas leaks, cooker issues
- Locksmiths: Lock changes, key issues, security
- General Builders: Structural repairs, walls, floors
- Pest Control: Rodents, insects, birds
- Cleaning: Deep clean, mould removal, end of tenancy
- Appliance Repair: White goods, dishwashers, ovens

Determine the best action and provide an appropriate response.
`;
  }

  /**
   * Assess maintenance priority
   */
  assessMaintenancePriority(issueDescription: string): {
    priority: 'emergency' | 'urgent' | 'high' | 'medium' | 'low';
    responseTime: string;
    category: string;
    requiresEmergencyCallout: boolean;
  } {
    const description = issueDescription.toLowerCase();

    // Emergency keywords
    const emergencyKeywords = ['gas leak', 'gas smell', 'no heating', 'flood', 'flooding', 'fire', 'smoke', 'security', 'break-in', 'broken window', 'no electricity'];
    if (emergencyKeywords.some(kw => description.includes(kw))) {
      return {
        priority: 'emergency',
        responseTime: 'Within 1 hour',
        category: this.categorizeIssue(description),
        requiresEmergencyCallout: true,
      };
    }

    // Urgent keywords
    const urgentKeywords = ['no hot water', 'lock', 'locked out', 'electrical', 'power', 'sewage', 'blocked toilet', 'overflow'];
    if (urgentKeywords.some(kw => description.includes(kw))) {
      return {
        priority: 'urgent',
        responseTime: 'Within 4 hours',
        category: this.categorizeIssue(description),
        requiresEmergencyCallout: false,
      };
    }

    // High priority
    const highKeywords = ['leak', 'roof', 'ceiling', 'boiler', 'heating', 'appliance', 'fridge', 'freezer', 'washing machine', 'pest', 'mice', 'rats', 'cockroach'];
    if (highKeywords.some(kw => description.includes(kw))) {
      return {
        priority: 'high',
        responseTime: 'Within 24 hours',
        category: this.categorizeIssue(description),
        requiresEmergencyCallout: false,
      };
    }

    // Medium priority
    const mediumKeywords = ['drip', 'tap', 'door', 'handle', 'drawer', 'cupboard', 'window', 'blind', 'curtain'];
    if (mediumKeywords.some(kw => description.includes(kw))) {
      return {
        priority: 'medium',
        responseTime: 'Within 48 hours',
        category: this.categorizeIssue(description),
        requiresEmergencyCallout: false,
      };
    }

    // Default to low
    return {
      priority: 'low',
      responseTime: 'Within 5 working days',
      category: this.categorizeIssue(description),
      requiresEmergencyCallout: false,
    };
  }

  /**
   * Categorize the maintenance issue
   */
  private categorizeIssue(description: string): string {
    const categories: { keywords: string[]; category: string }[] = [
      { keywords: ['plumb', 'leak', 'tap', 'pipe', 'drain', 'toilet', 'sink', 'bath', 'shower'], category: 'Plumbing' },
      { keywords: ['boiler', 'heating', 'radiator', 'hot water', 'central heating'], category: 'Heating' },
      { keywords: ['gas', 'cooker', 'hob', 'oven'], category: 'Gas' },
      { keywords: ['electric', 'socket', 'light', 'power', 'fuse', 'switch'], category: 'Electrical' },
      { keywords: ['lock', 'key', 'door', 'security'], category: 'Locksmith' },
      { keywords: ['pest', 'mice', 'rat', 'cockroach', 'ant', 'wasp', 'bee', 'pigeon'], category: 'Pest Control' },
      { keywords: ['roof', 'gutter', 'chimney', 'external'], category: 'Roofing' },
      { keywords: ['window', 'glass', 'glazing'], category: 'Glazing' },
      { keywords: ['appliance', 'dishwasher', 'washing machine', 'dryer', 'fridge', 'freezer'], category: 'Appliances' },
      { keywords: ['damp', 'mould', 'condensation'], category: 'Damp & Mould' },
      { keywords: ['paint', 'decorate', 'wallpaper'], category: 'Decorating' },
    ];

    for (const { keywords, category } of categories) {
      if (keywords.some(kw => description.includes(kw))) {
        return category;
      }
    }

    return 'General Repairs';
  }

  /**
   * Create a maintenance ticket
   */
  createMaintenanceTicket(
    propertyId: number,
    reportedBy: { name: string; email?: string; phone?: string; type: 'tenant' | 'landlord' },
    issue: { description: string; location?: string; accessInstructions?: string }
  ): {
    ticketId: string;
    priority: ReturnType<MaintenanceAgent['assessMaintenancePriority']>;
    createdAt: Date;
    status: 'open' | 'assigned' | 'in_progress' | 'awaiting_parts' | 'completed';
    estimatedCompletion: Date;
  } {
    const priority = this.assessMaintenancePriority(issue.description);
    const ticketId = `MT-${Date.now().toString(36).toUpperCase()}`;

    // Calculate estimated completion based on priority
    const now = new Date();
    const estimatedCompletion = new Date(now);

    switch (priority.priority) {
      case 'emergency':
        estimatedCompletion.setHours(estimatedCompletion.getHours() + 4);
        break;
      case 'urgent':
        estimatedCompletion.setHours(estimatedCompletion.getHours() + 24);
        break;
      case 'high':
        estimatedCompletion.setDate(estimatedCompletion.getDate() + 2);
        break;
      case 'medium':
        estimatedCompletion.setDate(estimatedCompletion.getDate() + 5);
        break;
      case 'low':
        estimatedCompletion.setDate(estimatedCompletion.getDate() + 10);
        break;
    }

    return {
      ticketId,
      priority,
      createdAt: now,
      status: 'open',
      estimatedCompletion,
    };
  }

  /**
   * Select best contractor for the job
   */
  selectContractor(
    category: string,
    priority: 'emergency' | 'urgent' | 'high' | 'medium' | 'low',
    postcode: string,
    contractors: Array<{
      id: number;
      name: string;
      categories: string[];
      rating: number;
      responseTime: number; // hours
      coverageAreas: string[];
      isAvailableNow: boolean;
      emergencyCallout: boolean;
    }>
  ): {
    contractor: typeof contractors[0] | null;
    alternatives: typeof contractors;
    reasoning: string;
  } {
    const postcodePrefix = postcode.split(' ')[0];

    // Filter contractors by category and coverage
    let eligible = contractors.filter(c =>
      c.categories.some(cat => cat.toLowerCase() === category.toLowerCase()) &&
      c.coverageAreas.some(area => area.toLowerCase() === postcodePrefix.toLowerCase())
    );

    // For emergency, filter to those with emergency callout
    if (priority === 'emergency') {
      eligible = eligible.filter(c => c.emergencyCallout && c.isAvailableNow);
    }

    if (eligible.length === 0) {
      return {
        contractor: null,
        alternatives: [],
        reasoning: `No contractors available for ${category} in ${postcodePrefix}`,
      };
    }

    // Score contractors
    const scored = eligible.map(c => ({
      contractor: c,
      score: (c.rating * 20) + (c.isAvailableNow ? 30 : 0) + (100 - c.responseTime),
    })).sort((a, b) => b.score - a.score);

    return {
      contractor: scored[0].contractor,
      alternatives: scored.slice(1, 4).map(s => s.contractor),
      reasoning: `Selected ${scored[0].contractor.name} based on ${scored[0].contractor.rating}★ rating and ${scored[0].contractor.responseTime}hr response time`,
    };
  }
}

export const maintenanceAgent = new MaintenanceAgent();
