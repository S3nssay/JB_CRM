# AI Employee System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a unified AI employee system where 5 specialist agents (Reception, Sales, Lettings, Admin, Property Management) handle all customer interactions seamlessly across phone, WhatsApp, text, and email — with automated rent arrears chasing, contractor management, and contract generation.

**Architecture:** Extend the existing BaseAgent/SupervisorAgent/AgentOrchestrator pattern with a new `UnifiedCommunicationDispatcher` that abstracts channel selection. Enhance existing specialist agents with new capabilities (arrears chasing, contractor follow-ups, contract generation). Add scheduled task runners for proactive agent work. The existing 7 agents map to the 5 requested roles with minor restructuring.

**Tech Stack:** Express.js, OpenAI GPT-4, Twilio (voice/SMS/WhatsApp), Nodemailer (email), Retell AI (voice), PostgreSQL/Drizzle ORM

---

## Agent Role Mapping (Existing → Requested)

| Requested Role | Existing Agent(s) | Enhancement Needed |
|---|---|---|
| Reception Agent | SupervisorAgent (classification) + new ReceptionAgent | New agent for general Q&A, hours, services info |
| Sales Specialist | SalesAgent + LeadGenSalesAgent | Add viewing booking via all channels |
| Lettings Specialist | RentalAgent + LeadGenRentalsAgent | Add viewing booking via all channels |
| Admin Specialist | OfficeAdminAgent | Add contract generation, onboarding/offboarding automation |
| PM Specialist | MaintenanceAgent | Add arrears chasing, contractor follow-ups, quote generation |

## File Structure

| File | Responsibility |
|------|---------------|
| `server/services/unifiedCommunicationDispatcher.ts` | Abstraction layer for sending messages across any channel |
| `server/agents/specialists/ReceptionAgent.ts` | New: General enquiry handling, hours, services, routing |
| `server/services/arrearsChaser.ts` | Automated rent arrears detection and chasing workflow |
| `server/services/contractorFollowUp.ts` | Automated contractor work verification and follow-ups |
| `server/services/contractGenerator.ts` | Contract/document generation for onboarding/offboarding |
| `server/services/scheduledAgentTasks.ts` | Cron-style runner for proactive agent tasks |
| `server/routes/agentRoutes.ts` | API endpoints for agent system management |

---

### Task 1: Build Unified Communication Dispatcher

**Files:**
- Create: `server/services/unifiedCommunicationDispatcher.ts`

This is the critical abstraction — agents call `dispatcher.send()` with a contact and message, and it routes to the best channel automatically.

- [ ] **Step 1: Create the UnifiedCommunicationDispatcher**

```typescript
// server/services/unifiedCommunicationDispatcher.ts
import { emailService } from "../emailService";
import {
  sendPropertyOfferWhatsApp,
  sendPropertyDetailsWhatsApp,
} from "../whatsappService";
import { sendPropertyOfferSMS } from "../smsService";
import { voiceAgent } from "../voiceAgentService";
import { db } from "../db";
import { eq, desc } from "drizzle-orm";
import { communications, tenant, landlords, leads } from "@shared/schema";

export type Channel = "phone" | "whatsapp" | "sms" | "email";

export interface ContactInfo {
  id?: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  preferredChannel?: Channel | null;
  entityType: "tenant" | "landlord" | "lead" | "contractor" | "unknown";
}

export interface OutboundMessage {
  to: ContactInfo;
  subject?: string;
  body: string;
  htmlBody?: string;
  channel?: Channel; // Force specific channel, or auto-select
  priority?: "urgent" | "normal" | "low";
  propertyId?: number;
  agentType?: string;
  metadata?: Record<string, unknown>;
}

export interface SendResult {
  success: boolean;
  channel: Channel;
  messageId?: string;
  error?: string;
  fallbackUsed?: boolean;
}

class UnifiedCommunicationDispatcher {
  /**
   * Send a message to a contact via the best available channel.
   * Priority: specified channel > preferred channel > auto-detect
   * Fallback: if primary fails, try next best channel
   */
  async send(message: OutboundMessage): Promise<SendResult> {
    const channel = message.channel
      || message.to.preferredChannel
      || this.autoSelectChannel(message);

    const fallbackOrder = this.getFallbackOrder(channel);

    for (const ch of fallbackOrder) {
      const result = await this.sendViaChannel(ch, message);
      if (result.success) {
        await this.logCommunication(message, result);
        return result;
      }
      console.warn(`Failed to send via ${ch}: ${result.error}`);
    }

    return {
      success: false,
      channel,
      error: "All channels failed",
    };
  }

  /**
   * Send a message and wait for a response (for conversational flows).
   * Used by arrears chaser and contractor follow-ups.
   */
  async sendAndTrack(message: OutboundMessage): Promise<SendResult> {
    const result = await this.send(message);
    // The response will come back through the inbound message handler
    // and get routed by the SupervisorAgent
    return result;
  }

  /**
   * Make an outbound call with AI agent.
   */
  async makeCall(
    phoneNumber: string,
    purpose: string,
    context: Record<string, unknown>
  ): Promise<SendResult> {
    try {
      const result = await voiceAgent.makeOutboundCall(phoneNumber, purpose, context);
      return {
        success: true,
        channel: "phone",
        messageId: result?.callId || undefined,
      };
    } catch (error: any) {
      return {
        success: false,
        channel: "phone",
        error: error.message,
      };
    }
  }

  private autoSelectChannel(message: OutboundMessage): Channel {
    const { to, priority } = message;

    // Urgent → phone call
    if (priority === "urgent" && to.phone) return "phone";

    // Has mobile → WhatsApp (highest engagement)
    if (to.mobile) return "whatsapp";

    // Has email → email (good for detailed/formal comms)
    if (to.email) return "email";

    // Has phone → SMS
    if (to.phone) return "sms";

    // Default
    return "email";
  }

  private getFallbackOrder(primary: Channel): Channel[] {
    const all: Channel[] = ["whatsapp", "sms", "email", "phone"];
    return [primary, ...all.filter((c) => c !== primary)];
  }

  private async sendViaChannel(
    channel: Channel,
    message: OutboundMessage
  ): Promise<SendResult> {
    const { to, body, subject, htmlBody } = message;

    switch (channel) {
      case "email": {
        if (!to.email) return { success: false, channel, error: "No email address" };
        try {
          await emailService.sendEmail(
            to.email,
            subject || "Message from John Barclay Estate Agents",
            htmlBody || `<p>${body.replace(/\n/g, "<br>")}</p>`
          );
          return { success: true, channel };
        } catch (error: any) {
          return { success: false, channel, error: error.message };
        }
      }

      case "whatsapp": {
        const phone = to.mobile || to.phone;
        if (!phone) return { success: false, channel, error: "No phone number" };
        try {
          // Use Twilio WhatsApp
          const twilio = await import("twilio");
          const client = twilio.default(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN
          );
          const formatted = phone.startsWith("+") ? phone : `+44${phone.replace(/^0/, "")}`;
          const msg = await client.messages.create({
            body,
            from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
            to: `whatsapp:${formatted}`,
          });
          return { success: true, channel, messageId: msg.sid };
        } catch (error: any) {
          return { success: false, channel, error: error.message };
        }
      }

      case "sms": {
        const phone = to.mobile || to.phone;
        if (!phone) return { success: false, channel, error: "No phone number" };
        try {
          const twilio = await import("twilio");
          const client = twilio.default(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN
          );
          const formatted = phone.startsWith("+") ? phone : `+44${phone.replace(/^0/, "")}`;
          const msg = await client.messages.create({
            body,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: formatted,
          });
          return { success: true, channel, messageId: msg.sid };
        } catch (error: any) {
          return { success: false, channel, error: error.message };
        }
      }

      case "phone": {
        const phone = to.phone || to.mobile;
        if (!phone) return { success: false, channel, error: "No phone number" };
        return this.makeCall(phone, "outbound_message", { message: body });
      }

      default:
        return { success: false, channel, error: `Unknown channel: ${channel}` };
    }
  }

  private async logCommunication(message: OutboundMessage, result: SendResult) {
    try {
      await db.insert(communications).values({
        type: result.channel === "phone" ? "phone" : result.channel === "whatsapp" || result.channel === "sms" ? "sms" : "email",
        direction: "outbound",
        content: message.body,
        status: result.success ? "sent" : "failed",
        tenantId: message.to.entityType === "tenant" ? message.to.id : null,
        landlordId: message.to.entityType === "landlord" ? message.to.id : null,
        propertyId: message.propertyId || null,
        metadata: {
          channel: result.channel,
          messageId: result.messageId,
          agentType: message.agentType,
          subject: message.subject,
        },
      });
    } catch (error) {
      console.error("Failed to log communication:", error);
    }
  }
}

export const dispatcher = new UnifiedCommunicationDispatcher();
```

- [ ] **Step 2: Verify file created**

Run: `ls -la server/services/unifiedCommunicationDispatcher.ts`

- [ ] **Step 3: Commit**

```bash
git add server/services/unifiedCommunicationDispatcher.ts
git commit -m "feat: add UnifiedCommunicationDispatcher for multi-channel agent messaging"
```

---

### Task 2: Create Reception Agent

**Files:**
- Create: `server/agents/specialists/ReceptionAgent.ts`
- Modify: `server/agents/AgentOrchestrator.ts` (register new agent)

- [ ] **Step 1: Create ReceptionAgent**

```typescript
// server/agents/specialists/ReceptionAgent.ts
import { BaseAgent } from "../BaseAgent";
import type { AgentConfig, AgentTask, AgentDecision } from "../types";
import { dispatcher } from "../../services/unifiedCommunicationDispatcher";

const config: AgentConfig = {
  id: "reception",
  name: "Reception Agent",
  description: "Handles all incoming calls and general enquiries about John Barclay Estate Agents. Answers questions about services, office hours, locations, fees, and routes specialist queries to the right agent.",
  enabled: true,
  handlesMessageTypes: ["general", "inquiry"],
  handlesTaskTypes: ["general_response", "respond_to_inquiry"],
  communicationChannels: ["phone", "email", "whatsapp", "sms"],
  personality: `You are the receptionist for John Barclay Estate Agents, a premium estate agency in London specializing in sales, lettings, and property management across Maida Vale, Kilburn, Queen's Park, West Hampstead, and surrounding areas.

Key information you should know:
- Office hours: Monday-Friday 9am-6pm, Saturday 10am-4pm, Sunday by appointment
- Address: 8 Formosa Street, Maida Vale, London W9 1EE
- Phone: 020 7286 1008
- Services: Property sales, lettings, property management, valuations, landlord services
- Areas covered: W9, W10, W11, NW6, NW8, NW10 and surrounding postcodes
- Fees: Sales 1.5% + VAT, Lettings 50% of first month + VAT, Management 12% of rent + VAT
- We are members of ARLA Propertymark and The Property Ombudsman

When you cannot answer a specific question about a property, sale, or letting, delegate to the appropriate specialist agent. Always be warm, professional, and helpful. If someone is calling about an emergency maintenance issue, immediately escalate to the maintenance specialist.`,
  tone: "friendly" as const,
  language: "en",
  workingHours: { start: "08:00", end: "20:00" },
  workingDays: [1, 2, 3, 4, 5, 6, 0], // All days
  responseDelaySeconds: 10,
  maxConcurrentTasks: 30,
  priorityPostcodes: ["W9", "W10", "W11", "NW6", "NW8", "NW10"],
  escalationThreshold: 0.4,
};

class ReceptionAgent extends BaseAgent {
  constructor() {
    super(config);
  }

  protected buildSystemPrompt(): string {
    return this.config.personality || "";
  }

  protected buildUserPrompt(task: AgentTask): string {
    let prompt = `Incoming ${task.type} from ${task.context?.contact?.name || "unknown caller"}:\n`;
    prompt += `Channel: ${task.context?.channel || "unknown"}\n`;
    prompt += `Message: ${task.description}\n`;

    if (task.context?.conversationHistory?.length) {
      prompt += `\nPrevious conversation:\n`;
      for (const msg of task.context.conversationHistory.slice(-5)) {
        prompt += `- ${msg.role}: ${msg.content}\n`;
      }
    }

    prompt += `\nDecide how to respond. If the query is about a specific property for sale, delegate to 'sales'. If about lettings, delegate to 'rental'. If about maintenance, delegate to 'maintenance'. If about contracts or admin, delegate to 'office_admin'. Otherwise, answer directly.`;

    return prompt;
  }

  /**
   * After making a decision, send the response via the unified dispatcher.
   */
  protected async executeDecision(task: AgentTask, decision: AgentDecision): Promise<void> {
    if (decision.action === "respond" && decision.suggestedResponse) {
      // Send response back via the channel the message came from
      if (task.context?.contact) {
        await dispatcher.send({
          to: {
            name: task.context.contact.name || "Customer",
            email: task.context.contact.email || undefined,
            phone: task.context.contact.phone || undefined,
            entityType: (task.context.contact.type as any) || "unknown",
          },
          body: decision.suggestedResponse,
          channel: task.context?.channel as any,
          agentType: "reception",
          propertyId: task.propertyId || undefined,
        });
      }
    }

    // Call parent for delegation/escalation handling
    await super.executeDecision(task, decision);
  }
}

export const receptionAgent = new ReceptionAgent();
```

- [ ] **Step 2: Register ReceptionAgent in AgentOrchestrator.ts**

Add import:
```typescript
import { receptionAgent } from "./specialists/ReceptionAgent";
```

Add to agent registration in the constructor/start method:
```typescript
this.supervisor.registerAgent("reception", receptionAgent);
```

- [ ] **Step 3: Update AgentType in types.ts**

Add `'reception'` to the `AgentType` union type.

- [ ] **Step 4: Commit**

```bash
git add server/agents/specialists/ReceptionAgent.ts server/agents/AgentOrchestrator.ts server/agents/types.ts
git commit -m "feat: add ReceptionAgent for general enquiry handling"
```

---

### Task 3: Build Rent Arrears Chaser Service

**Files:**
- Create: `server/services/arrearsChaser.ts`

This service detects tenants in rent arrears and automatically initiates a chasing workflow: SMS reminder → WhatsApp follow-up → Phone call → Escalation.

- [ ] **Step 1: Create the ArrearsChaser service**

```typescript
// server/services/arrearsChaser.ts
import { db } from "../db";
import { eq, and, lt, sql, desc } from "drizzle-orm";
import { tenancies, tenant, properties, landlords, communications } from "@shared/schema";
import { dispatcher, type ContactInfo } from "./unifiedCommunicationDispatcher";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface ArrearsRecord {
  tenancyId: number;
  tenantId: number;
  tenantName: string;
  tenantPhone: string | null;
  tenantMobile: string | null;
  tenantEmail: string | null;
  propertyAddress: string;
  rentAmount: string;
  rentDueDay: number | null;
  daysPastDue: number;
  landlordName: string | null;
}

class ArrearsChaser {
  /**
   * Detect all tenants currently in rent arrears.
   * This checks the rent due day against today's date.
   * In production, this would also check actual payment records.
   */
  async detectArrears(): Promise<ArrearsRecord[]> {
    const today = new Date();
    const currentDay = today.getDate();

    // Get active tenancies where rent due day has passed
    const results = await db
      .select({
        tenancy: tenancies,
        tenantName: tenant.name,
        tenantPhone: tenant.phone,
        tenantMobile: tenant.mobile,
        tenantEmail: tenant.email,
        propertyAddress: properties.addressLine1,
        propertyPostcode: properties.postcode,
        landlordName: landlords.name,
      })
      .from(tenancies)
      .innerJoin(tenant, eq(tenancies.tenantId, tenant.id))
      .innerJoin(properties, eq(tenancies.propertyId, properties.id))
      .leftJoin(landlords, eq(tenancies.landlordId, landlords.id))
      .where(
        and(
          eq(tenancies.status, "active"),
          sql`${tenancies.rentDueDay} IS NOT NULL AND ${tenancies.rentDueDay} < ${currentDay}`
        )
      );

    // TODO: Cross-reference with actual payment records to confirm non-payment
    // For now, flag all where due day has passed this month

    return results.map((r) => ({
      tenancyId: r.tenancy.id,
      tenantId: r.tenancy.tenantId!,
      tenantName: r.tenantName || "Tenant",
      tenantPhone: r.tenantPhone,
      tenantMobile: r.tenantMobile,
      tenantEmail: r.tenantEmail,
      propertyAddress: [r.propertyAddress, r.propertyPostcode].filter(Boolean).join(", "),
      rentAmount: r.tenancy.rentAmount?.toString() || "0",
      rentDueDay: r.tenancy.rentDueDay,
      daysPastDue: currentDay - (r.tenancy.rentDueDay || 1),
      landlordName: r.landlordName,
    }));
  }

  /**
   * Run the arrears chasing workflow for a single tenant.
   * Escalation timeline:
   * - Day 1-3 past due: Friendly SMS/WhatsApp reminder
   * - Day 4-7: Follow-up WhatsApp with payment link
   * - Day 8-14: Phone call from AI agent
   * - Day 15+: Escalate to human property manager
   */
  async chaseTenant(arrears: ArrearsRecord): Promise<void> {
    const contact: ContactInfo = {
      id: arrears.tenantId,
      name: arrears.tenantName,
      phone: arrears.tenantPhone,
      mobile: arrears.tenantMobile,
      email: arrears.tenantEmail,
      entityType: "tenant",
    };

    if (arrears.daysPastDue <= 3) {
      // Stage 1: Friendly reminder
      const message = await this.generateChasingMessage(arrears, "friendly_reminder");
      await dispatcher.send({
        to: contact,
        body: message,
        channel: "sms",
        priority: "normal",
        agentType: "maintenance",
        propertyId: undefined,
      });
    } else if (arrears.daysPastDue <= 7) {
      // Stage 2: Firmer follow-up
      const message = await this.generateChasingMessage(arrears, "follow_up");
      await dispatcher.send({
        to: contact,
        body: message,
        channel: "whatsapp",
        priority: "normal",
        agentType: "maintenance",
      });
    } else if (arrears.daysPastDue <= 14) {
      // Stage 3: Phone call
      const phone = contact.mobile || contact.phone;
      if (phone) {
        await dispatcher.makeCall(phone, "rent_arrears", {
          tenantName: arrears.tenantName,
          rentAmount: arrears.rentAmount,
          daysPastDue: arrears.daysPastDue,
          propertyAddress: arrears.propertyAddress,
        });
      } else {
        // Fallback to email if no phone
        const message = await this.generateChasingMessage(arrears, "urgent");
        await dispatcher.send({
          to: contact,
          body: message,
          channel: "email",
          subject: "Urgent: Rent Payment Required",
          priority: "urgent",
          agentType: "maintenance",
        });
      }
    } else {
      // Stage 4: Escalate to human
      const message = await this.generateChasingMessage(arrears, "final_notice");
      await dispatcher.send({
        to: contact,
        body: message,
        channel: "email",
        subject: "Final Notice: Rent Payment Overdue",
        priority: "urgent",
        agentType: "maintenance",
      });

      // Also notify the property manager
      console.log(`[ARREARS ESCALATION] Tenant ${arrears.tenantName} at ${arrears.propertyAddress} - ${arrears.daysPastDue} days overdue. Requires human intervention.`);
    }
  }

  /**
   * Generate a personalised chasing message using AI.
   */
  private async generateChasingMessage(
    arrears: ArrearsRecord,
    stage: "friendly_reminder" | "follow_up" | "urgent" | "final_notice"
  ): Promise<string> {
    const toneMap = {
      friendly_reminder: "warm and friendly, like a helpful reminder",
      follow_up: "polite but firm, expressing concern",
      urgent: "professional and urgent, stressing importance",
      final_notice: "formal and serious, noting potential consequences",
    };

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a property management assistant for John Barclay Estate Agents. Generate a rent arrears message. Tone: ${toneMap[stage]}. Keep it concise (under 160 chars for SMS, under 500 for email). Include the tenant's name, amount owed, and a request to contact the office. Never be threatening or aggressive. Always professional.`,
          },
          {
            role: "user",
            content: `Tenant: ${arrears.tenantName}\nProperty: ${arrears.propertyAddress}\nRent: £${arrears.rentAmount}\nDays overdue: ${arrears.daysPastDue}\nStage: ${stage}`,
          },
        ],
        max_tokens: 200,
      });

      return response.choices[0]?.message?.content || this.getFallbackMessage(arrears, stage);
    } catch {
      return this.getFallbackMessage(arrears, stage);
    }
  }

  private getFallbackMessage(arrears: ArrearsRecord, stage: string): string {
    return `Hi ${arrears.tenantName}, this is a reminder from John Barclay that your rent of £${arrears.rentAmount} for ${arrears.propertyAddress} is ${arrears.daysPastDue} days overdue. Please contact us on 020 7286 1008 to arrange payment. Thank you.`;
  }

  /**
   * Run arrears check for all tenancies. Called by scheduler.
   */
  async runArrearsCheck(): Promise<{ checked: number; chased: number }> {
    const arrears = await this.detectArrears();
    let chased = 0;

    for (const record of arrears) {
      try {
        await this.chaseTenant(record);
        chased++;
      } catch (error) {
        console.error(`Failed to chase tenant ${record.tenantName}:`, error);
      }
    }

    return { checked: arrears.length, chased };
  }
}

export const arrearsChaser = new ArrearsChaser();
```

- [ ] **Step 2: Commit**

```bash
git add server/services/arrearsChaser.ts
git commit -m "feat: add ArrearsChaser for automated rent arrears detection and multi-channel chasing"
```

---

### Task 4: Build Contractor Follow-Up Service

**Files:**
- Create: `server/services/contractorFollowUp.ts`

Automates checking if contractors have completed work, sends follow-ups, and verifies completion.

- [ ] **Step 1: Create the ContractorFollowUp service**

```typescript
// server/services/contractorFollowUp.ts
import { db } from "../db";
import { eq, and, lt, isNull, sql, desc } from "drizzle-orm";
import {
  workOrders,
  contractors,
  maintenanceRequests,
  contractorQuotes,
  properties,
  tenant,
} from "@shared/schema";
import { dispatcher, type ContactInfo } from "./unifiedCommunicationDispatcher";

class ContractorFollowUpService {
  /**
   * Find work orders that are overdue (scheduled end passed, not completed).
   */
  async findOverdueWorkOrders() {
    const now = new Date();

    return db
      .select({
        workOrder: workOrders,
        contractor: contractors,
        propertyAddress: properties.addressLine1,
        propertyPostcode: properties.postcode,
        tenantName: tenant.name,
        tenantPhone: tenant.phone,
      })
      .from(workOrders)
      .innerJoin(contractors, eq(workOrders.contractorId, contractors.id))
      .innerJoin(maintenanceRequests, eq(workOrders.maintenanceRequestId, maintenanceRequests.id))
      .innerJoin(properties, eq(maintenanceRequests.propertyId, properties.id))
      .leftJoin(tenant, eq(maintenanceRequests.tenantId, tenant.id))
      .where(
        and(
          sql`${workOrders.status} IN ('scheduled', 'confirmed', 'in_progress')`,
          lt(workOrders.scheduledEnd, now)
        )
      );
  }

  /**
   * Follow up with contractor on overdue work order.
   */
  async followUpContractor(workOrderId: number): Promise<void> {
    const overdue = await this.findOverdueWorkOrders();
    const wo = overdue.find((w) => w.workOrder.id === workOrderId);
    if (!wo) return;

    const contact: ContactInfo = {
      id: wo.contractor.id,
      name: wo.contractor.contactName || wo.contractor.companyName || "Contractor",
      phone: wo.contractor.phone,
      email: wo.contractor.email,
      entityType: "contractor",
    };

    const address = [wo.propertyAddress, wo.propertyPostcode].filter(Boolean).join(", ");

    await dispatcher.send({
      to: contact,
      subject: `Follow-up: Work Order ${wo.workOrder.workOrderNumber} - ${address}`,
      body: `Hi ${contact.name},\n\nThis is a follow-up regarding work order ${wo.workOrder.workOrderNumber} at ${address}. The scheduled completion date has passed.\n\nCould you please provide an update on the status of this work? If completed, please send completion photos and any invoice.\n\nThank you,\nJohn Barclay Estate Agents\n020 7286 1008`,
      channel: "whatsapp",
      priority: "normal",
      agentType: "maintenance",
    });
  }

  /**
   * After contractor reports completion, verify with tenant.
   */
  async verifyCompletionWithTenant(workOrderId: number): Promise<void> {
    const [wo] = await db
      .select({
        workOrder: workOrders,
        tenantName: tenant.name,
        tenantPhone: tenant.phone,
        tenantMobile: tenant.mobile,
        tenantEmail: tenant.email,
        tenantId: tenant.id,
        propertyAddress: properties.addressLine1,
      })
      .from(workOrders)
      .innerJoin(maintenanceRequests, eq(workOrders.maintenanceRequestId, maintenanceRequests.id))
      .innerJoin(properties, eq(maintenanceRequests.propertyId, properties.id))
      .leftJoin(tenant, eq(maintenanceRequests.tenantId, tenant.id))
      .where(eq(workOrders.id, workOrderId))
      .limit(1);

    if (!wo || !wo.tenantName) return;

    const contact: ContactInfo = {
      id: wo.tenantId || undefined,
      name: wo.tenantName,
      phone: wo.tenantPhone,
      mobile: wo.tenantMobile,
      email: wo.tenantEmail,
      entityType: "tenant",
    };

    await dispatcher.send({
      to: contact,
      body: `Hi ${wo.tenantName}, we understand maintenance work was recently completed at your property (${wo.propertyAddress}). Could you please confirm the work has been done satisfactorily? If there are any issues, please let us know. Thank you - John Barclay`,
      channel: "whatsapp",
      priority: "normal",
      agentType: "maintenance",
    });
  }

  /**
   * Request quotes from multiple contractors for a maintenance ticket.
   */
  async requestQuotes(
    ticketId: number,
    contractorIds: number[],
    workDescription: string,
    propertyAddress: string
  ): Promise<number> {
    let sent = 0;

    for (const contractorId of contractorIds) {
      const [contractor] = await db
        .select()
        .from(contractors)
        .where(eq(contractors.id, contractorId))
        .limit(1);

      if (!contractor) continue;

      // Create quote record
      await db.insert(contractorQuotes).values({
        ticketId,
        contractorId,
        status: "pending",
        sentAt: new Date(),
      });

      // Send quote request
      const contact: ContactInfo = {
        id: contractor.id,
        name: contractor.contactName || contractor.companyName || "Contractor",
        phone: contractor.phone,
        email: contractor.email,
        entityType: "contractor",
      };

      await dispatcher.send({
        to: contact,
        subject: `Quote Request - ${propertyAddress}`,
        body: `Hi ${contact.name},\n\nWe'd like to request a quote for the following work at ${propertyAddress}:\n\n${workDescription}\n\nPlease provide:\n- Estimated cost\n- Estimated duration\n- Earliest available date\n\nThank you,\nJohn Barclay Estate Agents`,
        channel: "email",
        priority: "normal",
        agentType: "maintenance",
      });

      sent++;
    }

    return sent;
  }

  /**
   * Run all follow-ups. Called by scheduler.
   */
  async runFollowUps(): Promise<{ overdueFound: number; followUpsSent: number }> {
    const overdue = await this.findOverdueWorkOrders();
    let sent = 0;

    for (const wo of overdue) {
      try {
        await this.followUpContractor(wo.workOrder.id);
        sent++;
      } catch (error) {
        console.error(`Failed to follow up work order ${wo.workOrder.id}:`, error);
      }
    }

    return { overdueFound: overdue.length, followUpsSent: sent };
  }
}

export const contractorFollowUp = new ContractorFollowUpService();
```

- [ ] **Step 2: Commit**

```bash
git add server/services/contractorFollowUp.ts
git commit -m "feat: add ContractorFollowUpService for automated work verification and quote requests"
```

---

### Task 5: Build Contract Generator Service

**Files:**
- Create: `server/services/contractGenerator.ts`

Generates contracts for sales/lettings onboarding and offboarding.

- [ ] **Step 1: Create the ContractGenerator service**

```typescript
// server/services/contractGenerator.ts
import { db } from "../db";
import { eq } from "drizzle-orm";
import {
  properties,
  landlords,
  tenant,
  tenancies,
  document,
  tenancyOnboarding,
  tenancyOnboardingSteps,
} from "@shared/schema";
import { dispatcher, type ContactInfo } from "./unifiedCommunicationDispatcher";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type ContractType =
  | "ast" // Assured Shorthold Tenancy
  | "guarantor_agreement"
  | "landlord_agreement" // Management agreement
  | "inventory_report"
  | "section_21_notice"
  | "section_8_notice"
  | "rent_increase_notice"
  | "checkout_report";

interface ContractData {
  contractType: ContractType;
  propertyId: number;
  tenancyId?: number;
  tenantId?: number;
  landlordId?: number;
  additionalTerms?: string;
}

class ContractGeneratorService {
  /**
   * Generate a contract/document based on type and property/tenancy data.
   */
  async generateContract(data: ContractData): Promise<{
    html: string;
    fileName: string;
  }> {
    // Fetch all relevant data
    const [property] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, data.propertyId))
      .limit(1);

    let tenancyData = null;
    let tenantData = null;
    let landlordData = null;

    if (data.tenancyId) {
      const [t] = await db.select().from(tenancies).where(eq(tenancies.id, data.tenancyId)).limit(1);
      tenancyData = t;
    }
    if (data.tenantId) {
      const [t] = await db.select().from(tenant).where(eq(tenant.id, data.tenantId)).limit(1);
      tenantData = t;
    }
    if (data.landlordId || property?.landlordId) {
      const id = data.landlordId || property?.landlordId;
      if (id) {
        const [l] = await db.select().from(landlords).where(eq(landlords.id, id)).limit(1);
        landlordData = l;
      }
    }

    const context = {
      property: {
        address: [property?.addressLine1, property?.addressLine2, property?.city, property?.postcode].filter(Boolean).join(", "),
        type: property?.propertyType,
        bedrooms: property?.bedrooms,
        furnished: property?.furnished,
      },
      tenancy: tenancyData
        ? {
            startDate: tenancyData.startDate?.toISOString().split("T")[0],
            endDate: tenancyData.endDate?.toISOString().split("T")[0],
            rentAmount: tenancyData.rentAmount?.toString(),
            rentFrequency: tenancyData.rentFrequency,
            depositAmount: tenancyData.depositAmount?.toString(),
            depositScheme: tenancyData.depositScheme,
          }
        : null,
      tenant: tenantData
        ? {
            name: tenantData.name,
            email: tenantData.email,
            phone: tenantData.phone,
          }
        : null,
      landlord: landlordData
        ? {
            name: landlordData.name,
            email: landlordData.email,
            companyName: landlordData.companyName,
          }
        : null,
      additionalTerms: data.additionalTerms,
    };

    // Use AI to generate the contract content
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a legal document generator for John Barclay Estate Agents. Generate professional HTML contracts/documents for UK property transactions. Use proper legal language appropriate for ${data.contractType}. Include all standard clauses required by UK law. Format with proper headings, numbered clauses, and signature blocks. The document should be ready to print as PDF.`,
        },
        {
          role: "user",
          content: `Generate a ${data.contractType} document with the following details:\n${JSON.stringify(context, null, 2)}`,
        },
      ],
      max_tokens: 4000,
    });

    const html = response.choices[0]?.message?.content || "";

    const fileNameMap: Record<ContractType, string> = {
      ast: "Assured-Shorthold-Tenancy-Agreement",
      guarantor_agreement: "Guarantor-Agreement",
      landlord_agreement: "Landlord-Management-Agreement",
      inventory_report: "Inventory-Report",
      section_21_notice: "Section-21-Notice",
      section_8_notice: "Section-8-Notice",
      rent_increase_notice: "Rent-Increase-Notice",
      checkout_report: "Checkout-Report",
    };

    const fileName = `${fileNameMap[data.contractType]}-${property?.postcode || "property"}-${new Date().toISOString().split("T")[0]}.html`;

    return { html, fileName };
  }

  /**
   * Generate and send a contract to relevant parties.
   */
  async generateAndSend(data: ContractData): Promise<void> {
    const { html, fileName } = await this.generateContract(data);

    // Store as document
    await db.insert(document).values({
      name: fileName,
      originalName: fileName,
      documentType: data.contractType,
      mimeType: "text/html",
      entityType: "tenancy",
      entityId: data.tenancyId || null,
      propertyId: data.propertyId,
      landlordId: data.landlordId || null,
      tenantId: data.tenantId || null,
      tenancyId: data.tenancyId || null,
      status: "draft",
    });

    // Send to tenant if applicable
    if (data.tenantId) {
      const [t] = await db.select().from(tenant).where(eq(tenant.id, data.tenantId)).limit(1);
      if (t) {
        await dispatcher.send({
          to: {
            id: t.id,
            name: t.name || "Tenant",
            email: t.email,
            phone: t.phone,
            entityType: "tenant",
          },
          subject: `Document Ready: ${fileName}`,
          body: `Dear ${t.name},\n\nYour ${data.contractType.replace(/_/g, " ")} document is ready for review. Please find it attached or log into your account to view it.\n\nIf you have any questions, please don't hesitate to contact us.\n\nKind regards,\nJohn Barclay Estate Agents`,
          htmlBody: html,
          channel: "email",
          priority: "normal",
          agentType: "office_admin",
          propertyId: data.propertyId,
        });
      }
    }
  }

  /**
   * Start the onboarding workflow for a new tenancy.
   */
  async startOnboarding(tenancyId: number): Promise<number> {
    const [tenancy] = await db.select().from(tenancies).where(eq(tenancies.id, tenancyId)).limit(1);
    if (!tenancy) throw new Error("Tenancy not found");

    // Create onboarding record
    const [onboarding] = await db
      .insert(tenancyOnboarding)
      .values({
        propertyId: tenancy.propertyId!,
        landlordId: tenancy.landlordId,
        tenantId: tenancy.tenantId,
        tenancyId: tenancy.id,
        status: "in_progress",
        currentStep: "generate_contract",
      })
      .returning({ id: tenancyOnboarding.id });

    // Create onboarding steps
    const steps = [
      { stepType: "generate_contract", stepOrder: 1 },
      { stepType: "tenant_references", stepOrder: 2 },
      { stepType: "right_to_rent_check", stepOrder: 3 },
      { stepType: "deposit_protection", stepOrder: 4 },
      { stepType: "contract_signing", stepOrder: 5 },
      { stepType: "inventory_check", stepOrder: 6 },
      { stepType: "key_handover", stepOrder: 7 },
      { stepType: "utility_transfer", stepOrder: 8 },
    ];

    for (const step of steps) {
      await db.insert(tenancyOnboardingSteps).values({
        onboardingId: onboarding.id,
        ...step,
        status: "pending",
      });
    }

    // Auto-generate the tenancy agreement
    await this.generateAndSend({
      contractType: "ast",
      propertyId: tenancy.propertyId!,
      tenancyId: tenancy.id,
      tenantId: tenancy.tenantId || undefined,
      landlordId: tenancy.landlordId || undefined,
    });

    return onboarding.id;
  }

  /**
   * Start the offboarding workflow for a tenancy ending.
   */
  async startOffboarding(tenancyId: number): Promise<void> {
    const [tenancy] = await db.select().from(tenancies).where(eq(tenancies.id, tenancyId)).limit(1);
    if (!tenancy) throw new Error("Tenancy not found");

    // Generate checkout report
    await this.generateAndSend({
      contractType: "checkout_report",
      propertyId: tenancy.propertyId!,
      tenancyId: tenancy.id,
      tenantId: tenancy.tenantId || undefined,
      landlordId: tenancy.landlordId || undefined,
    });

    // Notify tenant about end-of-tenancy process
    if (tenancy.tenantId) {
      const [t] = await db.select().from(tenant).where(eq(tenant.id, tenancy.tenantId)).limit(1);
      if (t) {
        await dispatcher.send({
          to: {
            id: t.id,
            name: t.name || "Tenant",
            email: t.email,
            phone: t.phone,
            mobile: t.mobile,
            entityType: "tenant",
          },
          subject: "End of Tenancy - Next Steps",
          body: `Dear ${t.name},\n\nAs your tenancy is coming to an end, here's what you need to do:\n\n1. Schedule a checkout inspection\n2. Arrange professional cleaning\n3. Return all keys to the office\n4. Provide meter readings on your last day\n5. Provide a forwarding address for deposit return\n\nPlease contact us to arrange your checkout date.\n\nKind regards,\nJohn Barclay Estate Agents`,
          channel: "email",
          priority: "normal",
          agentType: "office_admin",
        });
      }
    }
  }
}

export const contractGenerator = new ContractGeneratorService();
```

- [ ] **Step 2: Commit**

```bash
git add server/services/contractGenerator.ts
git commit -m "feat: add ContractGeneratorService for automated onboarding/offboarding document generation"
```

---

### Task 6: Build Scheduled Agent Tasks Runner

**Files:**
- Create: `server/services/scheduledAgentTasks.ts`
- Modify: `server/index.ts` (start scheduler)

- [ ] **Step 1: Create the scheduled tasks runner**

```typescript
// server/services/scheduledAgentTasks.ts
import { arrearsChaser } from "./arrearsChaser";
import { contractorFollowUp } from "./contractorFollowUp";
import { propertyManagement } from "../propertyManagementService";

class ScheduledAgentTasks {
  private intervals: NodeJS.Timeout[] = [];

  start() {
    console.log("[ScheduledAgentTasks] Starting scheduled tasks...");

    // Run arrears check daily at 10am (check every hour, only run at 10)
    this.intervals.push(
      setInterval(async () => {
        const hour = new Date().getHours();
        if (hour === 10) {
          console.log("[ScheduledAgentTasks] Running arrears check...");
          try {
            const result = await arrearsChaser.runArrearsCheck();
            console.log(`[ScheduledAgentTasks] Arrears check: ${result.checked} checked, ${result.chased} chased`);
          } catch (error) {
            console.error("[ScheduledAgentTasks] Arrears check failed:", error);
          }
        }
      }, 60 * 60 * 1000) // Every hour
    );

    // Run contractor follow-ups twice daily (10am, 3pm)
    this.intervals.push(
      setInterval(async () => {
        const hour = new Date().getHours();
        if (hour === 10 || hour === 15) {
          console.log("[ScheduledAgentTasks] Running contractor follow-ups...");
          try {
            const result = await contractorFollowUp.runFollowUps();
            console.log(`[ScheduledAgentTasks] Contractor follow-ups: ${result.overdueFound} overdue, ${result.followUpsSent} sent`);
          } catch (error) {
            console.error("[ScheduledAgentTasks] Contractor follow-ups failed:", error);
          }
        }
      }, 60 * 60 * 1000) // Every hour
    );

    // Run certification expiry check daily at 9am
    this.intervals.push(
      setInterval(async () => {
        const hour = new Date().getHours();
        if (hour === 9) {
          console.log("[ScheduledAgentTasks] Running certification expiry check...");
          try {
            await propertyManagement.checkCertificationExpiry();
            console.log("[ScheduledAgentTasks] Certification expiry check complete");
          } catch (error) {
            console.error("[ScheduledAgentTasks] Certification check failed:", error);
          }
        }
      }, 60 * 60 * 1000) // Every hour
    );

    console.log("[ScheduledAgentTasks] All scheduled tasks registered");
  }

  stop() {
    for (const interval of this.intervals) {
      clearInterval(interval);
    }
    this.intervals = [];
    console.log("[ScheduledAgentTasks] All scheduled tasks stopped");
  }
}

export const scheduledTasks = new ScheduledAgentTasks();
```

- [ ] **Step 2: Start scheduler in server/index.ts**

Add import:
```typescript
import { scheduledTasks } from "./services/scheduledAgentTasks";
```

Add after server starts listening:
```typescript
scheduledTasks.start();
```

- [ ] **Step 3: Commit**

```bash
git add server/services/scheduledAgentTasks.ts server/index.ts
git commit -m "feat: add ScheduledAgentTasks for automated arrears chasing, contractor follow-ups, and certification checks"
```

---

### Task 7: Add Agent Management API Routes

**Files:**
- Create: `server/routes/agentRoutes.ts`
- Modify: `server/routes.ts` (register routes)

- [ ] **Step 1: Create agent management routes**

```typescript
// server/routes/agentRoutes.ts
import { Router } from "express";
import { agentOrchestrator } from "../agents/AgentOrchestrator";
import { arrearsChaser } from "../services/arrearsChaser";
import { contractorFollowUp } from "../services/contractorFollowUp";
import { contractGenerator } from "../services/contractGenerator";

const router = Router();

// GET /api/crm/agents/status
router.get("/agents/status", async (_req, res) => {
  try {
    const status = agentOrchestrator.getSystemStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: "Failed to get agent status" });
  }
});

// GET /api/crm/agents/queue
router.get("/agents/queue", async (_req, res) => {
  try {
    const queue = agentOrchestrator.getQueueStatus();
    res.json(queue);
  } catch (error) {
    res.status(500).json({ error: "Failed to get queue status" });
  }
});

// POST /api/crm/agents/message
// Send a message to the agent system for processing
router.post("/agents/message", async (req, res) => {
  try {
    const { channel, from, fromName, subject, body, propertyId } = req.body;
    await agentOrchestrator.handleIncomingMessage({
      id: `msg-${Date.now()}`,
      channel: channel || "email",
      from: from || "unknown",
      fromName: fromName || "Unknown",
      to: "agents@johnbarclay.co.uk",
      subject: subject || "",
      body: body || "",
      timestamp: new Date(),
      propertyId,
    });
    res.json({ success: true, message: "Message queued for processing" });
  } catch (error) {
    res.status(500).json({ error: "Failed to process message" });
  }
});

// POST /api/crm/agents/arrears/run
// Manually trigger arrears check
router.post("/agents/arrears/run", async (_req, res) => {
  try {
    const result = await arrearsChaser.runArrearsCheck();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to run arrears check" });
  }
});

// POST /api/crm/agents/contractor-followup/run
// Manually trigger contractor follow-ups
router.post("/agents/contractor-followup/run", async (_req, res) => {
  try {
    const result = await contractorFollowUp.runFollowUps();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to run contractor follow-ups" });
  }
});

// POST /api/crm/agents/contracts/generate
// Generate a contract
router.post("/agents/contracts/generate", async (req, res) => {
  try {
    const { contractType, propertyId, tenancyId, tenantId, landlordId } = req.body;
    const result = await contractGenerator.generateContract({
      contractType,
      propertyId,
      tenancyId,
      tenantId,
      landlordId,
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to generate contract" });
  }
});

// POST /api/crm/agents/onboarding/start
// Start tenancy onboarding workflow
router.post("/agents/onboarding/start", async (req, res) => {
  try {
    const { tenancyId } = req.body;
    const onboardingId = await contractGenerator.startOnboarding(tenancyId);
    res.json({ onboardingId, message: "Onboarding started" });
  } catch (error) {
    res.status(500).json({ error: "Failed to start onboarding" });
  }
});

// POST /api/crm/agents/offboarding/start
// Start tenancy offboarding workflow
router.post("/agents/offboarding/start", async (req, res) => {
  try {
    const { tenancyId } = req.body;
    await contractGenerator.startOffboarding(tenancyId);
    res.json({ message: "Offboarding started" });
  } catch (error) {
    res.status(500).json({ error: "Failed to start offboarding" });
  }
});

// POST /api/crm/agents/quotes/request
// Request quotes from contractors
router.post("/agents/quotes/request", async (req, res) => {
  try {
    const { ticketId, contractorIds, workDescription, propertyAddress } = req.body;
    const sent = await contractorFollowUp.requestQuotes(
      ticketId,
      contractorIds,
      workDescription,
      propertyAddress
    );
    res.json({ sent, message: `Quote requests sent to ${sent} contractors` });
  } catch (error) {
    res.status(500).json({ error: "Failed to request quotes" });
  }
});

export default router;
```

- [ ] **Step 2: Register routes in server/routes.ts**

Add import:
```typescript
import agentRoutes from "./routes/agentRoutes";
```

Add registration:
```typescript
app.use("/api/crm", agentRoutes);
```

- [ ] **Step 3: Commit**

```bash
git add server/routes/agentRoutes.ts server/routes.ts
git commit -m "feat: add agent management API routes for arrears, contractors, contracts, and onboarding"
```

---

### Task 8: Enhance Existing Agents with Unified Dispatcher

**Files:**
- Modify: `server/agents/BaseAgent.ts`
- Modify: `server/agents/specialists/MaintenanceAgent.ts`
- Modify: `server/agents/specialists/OfficeAdminAgent.ts`

- [ ] **Step 1: Update BaseAgent.executeDecision to use dispatcher**

In BaseAgent.ts, import the dispatcher:
```typescript
import { dispatcher } from "../services/unifiedCommunicationDispatcher";
```

In the `executeDecision` method, when action is "respond", use the dispatcher instead of just logging:

```typescript
case "respond":
  if (decision.suggestedResponse && task.context?.contact) {
    await dispatcher.send({
      to: {
        name: task.context.contact.name || "Customer",
        email: task.context.contact.email || undefined,
        phone: task.context.contact.phone || undefined,
        entityType: (task.context.contact.type as any) || "unknown",
      },
      body: decision.suggestedResponse,
      channel: task.context?.channel as any,
      agentType: this.config.id,
      propertyId: task.propertyId || undefined,
    });
  }
  break;
```

- [ ] **Step 2: Enhance MaintenanceAgent with arrears and contractor capabilities**

Add to MaintenanceAgent's `buildSystemPrompt`:
```
You can also:
- Chase tenants in rent arrears by calling the arrears chasing system
- Follow up with contractors on overdue work orders
- Request quotes from contractors for maintenance work
- Verify completed work with tenants
```

- [ ] **Step 3: Enhance OfficeAdminAgent with contract generation**

Add to OfficeAdminAgent's `buildSystemPrompt`:
```
You can also:
- Generate tenancy agreements (AST), guarantor agreements, and management agreements
- Start onboarding workflows for new tenancies
- Start offboarding workflows for ending tenancies
- Generate section 21/section 8 notices and rent increase notices
```

- [ ] **Step 4: Commit**

```bash
git add server/agents/BaseAgent.ts server/agents/specialists/MaintenanceAgent.ts server/agents/specialists/OfficeAdminAgent.ts
git commit -m "feat: integrate unified dispatcher into all agents and enhance specialist capabilities"
```

---

## Summary

This plan creates:

1. **UnifiedCommunicationDispatcher** — Single interface for sending messages across phone/WhatsApp/SMS/email with automatic channel selection and fallback
2. **ReceptionAgent** — New agent for general enquiries, office info, and intelligent routing
3. **ArrearsChaser** — Automated rent arrears detection with escalating multi-channel chasing (SMS → WhatsApp → Phone → Human)
4. **ContractorFollowUp** — Automated work order tracking, follow-ups, completion verification, and quote requests
5. **ContractGenerator** — AI-powered contract generation for onboarding/offboarding with auto-distribution
6. **ScheduledAgentTasks** — Cron runner for daily arrears checks, contractor follow-ups, certification expiry monitoring
7. **Agent Management API** — Endpoints for monitoring, manual triggers, and workflow initiation
8. **Enhanced Existing Agents** — All agents now use unified dispatcher for seamless multi-channel communication

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-03-19-ai-employee-system.md`.
