/**
 * Office Administration Agent
 * Handles contract management, document handling, scheduling, and general admin
 */

import { BaseAgent } from '../BaseAgent';
import { AgentTask, TaskContext, AgentConfig } from '../types';

export class OfficeAdminAgent extends BaseAgent {
  constructor(customConfig?: Partial<AgentConfig>) {
    super({
      id: 'office_admin',
      name: 'Office Administration Agent',
      description: 'Manages all administrative tasks including contracts, documents, scheduling, and general office operations.',
      enabled: true,
      handlesMessageTypes: ['contract_request', 'general'],
      handlesTaskTypes: ['send_contract', 'update_crm', 'send_notification', 'general_response'],
      communicationChannels: ['email', 'whatsapp'],
      personality: 'Organized, efficient, and detail-oriented. Ensures all administrative processes run smoothly and documentation is complete.',
      tone: 'professional',
      language: 'en-GB',
      workingHours: { start: '09:00', end: '17:30' },
      workingDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
      responseDelaySeconds: 60,
      maxConcurrentTasks: 25,
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
CONTACT INFORMATION:
Name: ${context.contact.name}
Type: ${context.contact.type}
Email: ${context.contact.email || 'Not provided'}
Phone: ${context.contact.phone || 'Not provided'}
` : ''}

OFFICE ADMIN AGENT GUIDELINES:

CONTRACT TYPES:
- Sole Agency Agreement: For vendors instructing us to sell their property
- Marketing Agreement: For landlords instructing us to let their property
- Property Management Agreement: Full management service
- Assured Shorthold Tenancy (AST): Tenancy agreement
- Inventory & Schedule of Condition: Property condition documentation
- Check-In/Check-Out Reports: Move-in and move-out documentation

DOCUMENT REQUIREMENTS:
- ID verification (passport/driving licence)
- Proof of address (utility bill, bank statement)
- Proof of ownership (title deeds, Land Registry)
- EPC certificate
- Gas Safety Certificate (CP12)
- EICR (Electrical Installation Condition Report)
- Right to Rent documentation (for tenants)

KEY TIMELINES:
- Sole Agency Agreement: Minimum 4-12 weeks
- Notice period for termination: Usually 2-4 weeks
- AST length: Typically 6-12 months
- Deposit return: Within 10 days of tenancy end

RESPONSE GUIDELINES:
1. Be helpful and clear about process requirements
2. Provide document checklists when relevant
3. Set clear expectations about timelines
4. Confirm receipt of documents promptly
5. Follow up on outstanding items professionally
6. Ensure GDPR compliance in all data handling

Determine the best action and provide an appropriate response.
`;
  }

  /**
   * Generate document checklist for a transaction type
   */
  generateDocumentChecklist(
    transactionType: 'sale' | 'purchase' | 'letting' | 'rental' | 'management'
  ): {
    required: string[];
    optional: string[];
    timeline: string;
    notes: string[];
  } {
    const checklists: Record<string, ReturnType<OfficeAdminAgent['generateDocumentChecklist']>> = {
      sale: {
        required: [
          'Proof of identity (passport or driving licence)',
          'Proof of address (utility bill dated within 3 months)',
          'Proof of ownership (title deeds or Land Registry)',
          'Energy Performance Certificate (EPC)',
          'Property Information Form (TA6)',
          'Fittings and Contents Form (TA10)',
        ],
        optional: [
          'Building regulations certificates',
          'Planning permissions',
          'Warranties and guarantees',
          'FENSA/Gas Safe certificates',
          'Leasehold information pack (if applicable)',
        ],
        timeline: 'Documents should be provided within 5 working days of instruction',
        notes: [
          'EPC must be valid and rated E or above',
          'We will instruct a solicitor on your behalf if required',
          'Property Information Form helps speed up the sales process',
        ],
      },
      purchase: {
        required: [
          'Proof of identity (passport or driving licence)',
          'Proof of address (utility bill dated within 3 months)',
          'Proof of funds (bank statement or mortgage agreement in principle)',
          'AML verification (we will complete this)',
        ],
        optional: [
          'Solicitor details',
          'Survey instructions',
        ],
        timeline: 'Documents required before offer can be formally submitted',
        notes: [
          'Mortgage in principle strengthens your offer',
          'We require proof of deposit funds',
          'Cash buyers may need additional verification',
        ],
      },
      letting: {
        required: [
          'Proof of identity (passport or driving licence)',
          'Proof of address (utility bill)',
          'Proof of ownership (title deeds)',
          'Energy Performance Certificate (EPC) - E rating or above',
          'Gas Safety Certificate (CP12) - must be annual',
          'EICR - valid for 5 years',
          'Landlord insurance confirmation',
        ],
        optional: [
          'Inventory and schedule of condition',
          'Floor plans',
          'Smoke/CO alarm test certificates',
          'Legionella risk assessment',
        ],
        timeline: 'All certificates must be in place before marketing',
        notes: [
          'Gas Safety Certificate required annually',
          'Deposit must be protected within 30 days',
          'How to Rent guide must be provided to tenants',
          'Property licensing may be required (check local authority)',
        ],
      },
      rental: {
        required: [
          'Proof of identity (passport or driving licence)',
          'Proof of address (utility bill or bank statement)',
          'Proof of income (3 months payslips or tax returns)',
          'Employer reference or accountant reference',
          'Previous landlord reference',
          'Right to Rent documentation',
        ],
        optional: [
          'Guarantor details (if required)',
          'Bank statements (3 months)',
          'University acceptance letter (for students)',
        ],
        timeline: 'Referencing typically takes 3-5 working days',
        notes: [
          'All adults over 18 must be referenced',
          'Right to Rent check is a legal requirement',
          'Deposit capped at 5 weeks rent',
          'No additional fees under Tenant Fees Act 2019',
        ],
      },
      management: {
        required: [
          'Landlord ID verification',
          'Property ownership proof',
          'Current EPC certificate',
          'Gas Safety Certificate',
          'EICR certificate',
          'Insurance policy details',
          'Bank details for rental payments',
        ],
        optional: [
          'Existing tenancy agreements',
          'Current tenant details',
          'Maintenance history',
          'Contractor preferences',
        ],
        timeline: 'Documents required before management handover',
        notes: [
          'We will manage all certificate renewals',
          'Monthly statements provided',
          'Maintenance authorisation limits to be agreed',
          '24/7 emergency service included',
        ],
      },
    };

    return checklists[transactionType] || checklists.sale;
  }

  /**
   * Calculate contract fees
   */
  calculateFees(
    transactionType: 'sale' | 'letting' | 'management',
    propertyValue: number,
    options?: {
      premiumMarketing?: boolean;
      professionalPhotography?: boolean;
      virtualTour?: boolean;
      fullManagement?: boolean;
    }
  ): {
    baseFee: number;
    additionalFees: { name: string; amount: number }[];
    totalFee: number;
    vat: number;
    totalIncVat: number;
    paymentTerms: string;
  } {
    let baseFee = 0;
    const additionalFees: { name: string; amount: number }[] = [];

    switch (transactionType) {
      case 'sale':
        // 1.5% commission with minimum fee
        baseFee = Math.max(propertyValue * 0.015, 1500);
        if (options?.premiumMarketing) {
          additionalFees.push({ name: 'Premium Marketing Package', amount: 500 });
        }
        if (options?.professionalPhotography) {
          additionalFees.push({ name: 'Professional Photography', amount: 250 });
        }
        if (options?.virtualTour) {
          additionalFees.push({ name: '3D Virtual Tour', amount: 350 });
        }
        break;

      case 'letting':
        // Letting fee: 50% of first month's rent or minimum
        const monthlyRent = propertyValue;
        baseFee = Math.max(monthlyRent * 0.5, 500);
        if (options?.professionalPhotography) {
          additionalFees.push({ name: 'Professional Photography', amount: 150 });
        }
        break;

      case 'management':
        // Management fee: 12% of monthly rent
        const managementMonthlyRent = propertyValue;
        baseFee = managementMonthlyRent * 0.12;
        if (options?.fullManagement) {
          // Add additional services
          additionalFees.push({ name: 'Rent Collection & Chasing', amount: 0 }); // Included
          additionalFees.push({ name: '24/7 Emergency Service', amount: 0 }); // Included
        }
        break;
    }

    const totalFee = baseFee + additionalFees.reduce((sum, f) => sum + f.amount, 0);
    const vat = totalFee * 0.2;

    return {
      baseFee,
      additionalFees,
      totalFee,
      vat,
      totalIncVat: totalFee + vat,
      paymentTerms: transactionType === 'management'
        ? 'Deducted monthly from rental income'
        : 'Due on completion/letting',
    };
  }

  /**
   * Schedule an appointment
   */
  async scheduleAppointment(
    type: 'valuation' | 'viewing' | 'check_in' | 'check_out' | 'inspection' | 'meeting',
    participants: { name: string; email: string; phone?: string }[],
    propertyAddress: string,
    preferredDates?: Date[],
    notes?: string
  ): Promise<{
    appointmentId: string;
    suggestedSlots: { date: Date; time: string }[];
    confirmationRequired: boolean;
  }> {
    const appointmentId = `APT-${Date.now().toString(36).toUpperCase()}`;

    // Generate suggested time slots
    const suggestedSlots: { date: Date; time: string }[] = [];
    const startDate = preferredDates?.[0] || new Date();

    for (let i = 0; i < 5; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);

      // Skip weekends for certain appointment types
      if (date.getDay() === 0) continue; // Skip Sunday

      const times = type === 'viewing'
        ? ['10:00', '11:00', '14:00', '15:00', '16:00', '17:00']
        : ['09:30', '10:30', '11:30', '14:00', '15:00'];

      for (const time of times.slice(0, 2)) {
        suggestedSlots.push({ date, time });
      }

      if (suggestedSlots.length >= 6) break;
    }

    return {
      appointmentId,
      suggestedSlots,
      confirmationRequired: true,
    };
  }
}

export const officeAdminAgent = new OfficeAdminAgent();
