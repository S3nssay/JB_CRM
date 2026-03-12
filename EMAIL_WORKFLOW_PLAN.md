# Email-Driven Workflow Automation — Architecture Plan

## Overview

Build an intelligent email processing pipeline that monitors all inbound email, uses AI to classify content, extract tasks, route documents, capture leads, and raise tickets — automatically putting work into the right queues and assigning it to the right people.

---

## What Already Exists

| Component | Status | Key Files |
|-----------|--------|-----------|
| Email ingestion (Microsoft Graph + IMAP) | **Built** | `emailProcessor.ts`, `imapPollingService.ts`, `webhookHandler.ts` |
| AI email classification (OpenAI) | **Built** | `emailProcessor.ts:performAiAnalysisRaw()` — categories, sentiment, priority, entities, action type |
| AI action agent | **Built** | `emailAIAgent.ts` — creates tickets, enquiries, processes contractor responses, routes to PM |
| Contact matching (sender → tenant/landlord/contractor/lead) | **Built** | `emailAIAgent.ts:matchContact()` |
| Support ticket creation from email | **Built** | `emailAIAgent.ts:handleSupportRequest()` |
| Ticket follow-up from email | **Built** | `emailAIAgent.ts:handleTicketUpdate()` |
| Property enquiry from email | **Partial** | Creates `customerEnquiry` but does NOT create a `lead` or link to properties |
| Contractor response processing | **Built** | Parses quotes, updates contractor quote status |
| Task table | **Built** | `task` table with assignedToId, taskType, entity links |
| Lead table | **Built** | Full `lead` table with pipeline statuses, property preferences, KYC, assignment |
| Document table | **Built** | Unified `document` table with entity_type/entity_id polymorphic storage |
| Department mailboxes | **Built** | sales@, lettings@, maintenance@ system mailboxes |
| Auto-acknowledgement emails | **Built** | Sends branded replies for tickets and enquiries |
| Email job queue | **Built** | `emailJobQueue` table for async processing |
| Attachment metadata storage | **Built** | Attachments stored as JSON metadata on `processedEmails` |
| Attachment file download/storage | **Not built** | Attachments are listed but **never downloaded or saved to disk/S3** |

---

## What Needs to Be Built

### Gap Analysis

| # | Gap | Impact |
|---|-----|--------|
| 1 | **No task creation from emails** | Emails classified but no tasks created in `task` queue |
| 2 | **No intelligent task assignment** | Tasks aren't auto-assigned based on department, property, role |
| 3 | **No attachment download/processing** | Attachment metadata is stored but files are never fetched from Graph API / IMAP |
| 4 | **No document classification from attachments** | Can't tell KYC from gas cert from tenancy agreement |
| 5 | **No document routing to entity repositories** | Documents aren't uploaded to landlord/property/tenant records |
| 6 | **Enquiries don't create leads** | `handlePropertyEnquiry` creates `customerEnquiry` but not a `lead` in the pipeline |
| 7 | **No property matching on enquiries** | AI extracts property references but they're not resolved to `property.id` |
| 8 | **No lead pipeline automation** | Leads aren't progressed through stages based on email activity |
| 9 | **No marketing-ready lead capture** | Lost/cold leads not captured with preferences for future marketing |
| 10 | **Incomplete AI prompt** | Current AI prompt doesn't classify document-heavy emails or extract task details |

---

## Architecture

### Processing Pipeline

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        EMAIL INGESTION (existing)                        │
│  Microsoft Graph Webhook / IMAP Polling → processedEmails table          │
└──────────────────┬───────────────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    STEP 1: AI ANALYSIS (existing, enhanced)               │
│  OpenAI GPT-4o classifies email:                                         │
│  - category, sentiment, priority, entities, actionType, senderType       │
│  NEW: + taskDetails[], documentClassifications[], propertyMatch           │
└──────────────────┬───────────────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                 STEP 2: ATTACHMENT PROCESSING (new)                       │
│  For each attachment on the email:                                        │
│  1. Download file from Graph API / IMAP                                  │
│  2. Upload to S3/local storage                                           │
│  3. AI classifies document type (KYC, gas cert, EPC, invoice, etc.)     │
│  4. Match to entity (landlord, property, tenant) based on:               │
│     - sender contact match                                               │
│     - AI-extracted entity references                                     │
│     - document naming conventions                                        │
│  5. Create record in `document` table with correct entity_type/entity_id │
└──────────────────┬───────────────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                 STEP 3: ACTION ROUTING (existing, enhanced)               │
│                                                                          │
│  ┌─────────────────────┐  ┌───────────────────┐  ┌──────────────────┐  │
│  │  MAINTENANCE EMAIL   │  │  SALES/LETTINGS   │  │  LANDLORD/       │  │
│  │  from tenant         │  │  ENQUIRY          │  │  DOCUMENT EMAIL  │  │
│  │                      │  │                   │  │                  │  │
│  │  → Create ticket     │  │  → Create lead    │  │  → File docs     │  │
│  │  → Create task       │  │  → Match property │  │  → Create task   │  │
│  │  → Assign to PM      │  │  → Create task    │  │  → Notify staff  │  │
│  │  → Auto-ack tenant   │  │  → Record enquiry │  │  → Auto-ack      │  │
│  └─────────────────────┘  │  → Auto-ack        │  └──────────────────┘  │
│                           │  → Assign agent     │                        │
│  ┌─────────────────────┐  └───────────────────┘  ┌──────────────────┐  │
│  │  CONTRACTOR EMAIL    │                         │  GENERAL/OTHER   │  │
│  │                      │                         │                  │  │
│  │  → Update quote      │                         │  → Create task   │  │
│  │  → Create task if    │                         │  → Route to dept │  │
│  │    action needed     │                         │  → Flag for      │  │
│  │  → Notify PM         │                         │    review        │  │
│  └─────────────────────┘                         └──────────────────┘  │
└──────────────────┬───────────────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│              STEP 4: TASK CREATION & ASSIGNMENT (new)                     │
│                                                                          │
│  For each identified action, create a `task` record:                     │
│  - title: AI-generated from email summary                                │
│  - taskType: mapped from AI actionType                                   │
│  - priority: from AI priority                                            │
│  - assignedToId: determined by Assignment Engine                         │
│  - Entity links: propertyId, leadId, landlordId, tenantId               │
│  - dueDate: calculated from priority + SLA rules                         │
│  - notes: AI summary + link to processed email                           │
│                                                                          │
│  ASSIGNMENT ENGINE rules (in priority order):                            │
│  1. Property has assigned PM → assign to that PM                         │
│  2. Lead has assigned agent → assign to that agent                       │
│  3. Department routing: sales@ → sales team, lettings@ → lettings team  │
│  4. Round-robin within department                                        │
│  5. Fallback: office manager                                             │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Enhanced AI Classification

### 1.1 Expand AI Prompt

**File:** `server/services/email/emailProcessor.ts` — `performAiAnalysisRaw()`

Expand the AI response schema to include:

```typescript
interface AiAnalysisResult {
  // ... existing fields ...

  // NEW: Task extraction
  tasks: {
    title: string;
    taskType: 'viewing' | 'call' | 'follow_up' | 'enquiry_response' |
              'document' | 'maintenance' | 'general';
    priority: 'urgent' | 'high' | 'normal' | 'low';
    description: string;
    dueWithinHours: number; // e.g., 1 for urgent, 24 for high, 48 for normal
  }[];

  // NEW: Document classification (for attachments)
  attachmentClassifications: {
    filename: string; // Match against attachment list
    documentType: 'passport' | 'driving_licence' | 'proof_of_address' |
                  'bank_statement' | 'gas_safety' | 'epc' | 'eicr' |
                  'tenancy_agreement' | 'inventory' | 'invoice' |
                  'insurance' | 'licence' | 'certificate' | 'photo' |
                  'reference' | 'other';
    entityType: 'landlord' | 'tenant' | 'property' | 'tenancy' | 'unknown';
    confidence: number;
    description: string;
  }[];

  // NEW: Property matching
  propertyMatch: {
    address: string; // Extracted address
    postcode: string; // Extracted postcode
    confidence: number;
  } | null;

  // NEW: Lead qualification
  leadDetails: {
    leadType: 'rental' | 'purchase' | 'both' | 'landlord' | 'seller';
    budget: string | null;
    bedrooms: number | null;
    areas: string[];
    moveInDate: string | null;
    requirements: string | null;
  } | null;
}
```

Update the system prompt to:
- Identify ALL tasks implied by the email (not just the primary action)
- Classify each attachment by name/context as a document type
- Guess which entity each document belongs to
- Extract property matching details (address, postcode)
- Extract lead qualification data from enquiries

### 1.2 Files to Modify

| File | Change |
|------|--------|
| `server/services/email/emailProcessor.ts` | Expand AI prompt, update `AiAnalysisResult` interface |
| `shared/schema.ts` | Add `aiExtractedTasks`, `aiAttachmentClassifications` JSON columns to `processedEmails` |

---

## Phase 2: Attachment Processing Pipeline

### 2.1 New Service: `emailAttachmentService.ts`

**File:** `server/services/email/emailAttachmentService.ts`

```
processAttachments(processedEmailId, attachmentMetadata[], aiClassifications[])
  │
  ├─ For each attachment:
  │   ├─ Download from Graph API (graphClient.getAttachment) or IMAP
  │   ├─ Save to uploads/documents/ (or S3)
  │   ├─ Determine document_type from AI classification
  │   ├─ Determine entity_type/entity_id:
  │   │   ├─ If sender is known tenant → tenantId = contact.id, propertyId = contact.propertyId
  │   │   ├─ If sender is known landlord → landlordId = contact.id
  │   │   ├─ If AI matched a property → propertyId from property lookup
  │   │   └─ If can't determine → flag for manual review
  │   │
  │   ├─ Create `document` record:
  │   │   ├─ name: original filename
  │   │   ├─ documentType: from AI classification
  │   │   ├─ entityType/entityId: determined above
  │   │   ├─ propertyId/landlordId/tenantId: set directly
  │   │   ├─ storageUrl: file path
  │   │   ├─ status: 'pending_review' (needs human confirmation)
  │   │   ├─ uploadedBy: 'system'
  │   │   └─ description: 'Auto-filed from email [subject]'
  │   │
  │   └─ If KYC document (passport, proof_of_address, bank_statement):
  │       ├─ Update landlord/tenant KYC status if applicable
  │       └─ Create task: "Review KYC document from [name]"
  │
  └─ Return list of created document IDs
```

### 2.2 Document Classification Rules

| Document Type | Entity Routing | Additional Action |
|--------------|----------------|-------------------|
| passport, driving_licence | KYC → landlord or tenant based on sender | Update KYC status to 'pending' |
| proof_of_address, bank_statement | KYC → landlord or tenant | Update KYC status to 'pending' |
| gas_safety, epc, eicr | Property → propertyId from context | Check expiry, flag if missing |
| tenancy_agreement | Tenancy → tenancyId from context | Create task: "Review tenancy agreement" |
| inventory, check_in, check_out | Property + Tenancy | Link to both |
| invoice | Landlord or Contractor | Route to accounting if purchase invoice |
| insurance, licence, certificate | Property | Check expiry dates |
| reference | Tenant (for referencing) | Flag for reference check |

### 2.3 Graph API Attachment Download

The `graphApiClient.ts` already has `getMessage(id, includeAttachments)`. Need to add:

```typescript
// New method on GraphApiClient
async getAttachmentContent(messageId: string, attachmentId: string): Promise<Buffer>
```

For IMAP, attachments are already parsed by `mailparser` in the IMAP polling service — just need to save the content.

### 2.4 Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `server/services/email/emailAttachmentService.ts` |
| MODIFY | `server/services/microsoft/graphApiClient.ts` — add `getAttachmentContent()` |
| MODIFY | `server/services/email/emailProcessor.ts` — call attachment processing after AI analysis |
| MODIFY | `server/services/email/emailAIAgent.ts` — pass attachment results to action handlers |

---

## Phase 3: Task Creation & Assignment Engine

### 3.1 New Service: `taskAssignmentService.ts`

**File:** `server/services/taskAssignmentService.ts`

Core responsibility: create tasks from email AI analysis and assign to the right person.

```typescript
class TaskAssignmentService {

  // Called by emailAIAgent after processing each email
  async createTasksFromEmail(
    processedEmailId: number,
    aiTasks: AiAnalysisResult['tasks'],
    context: {
      department: string | null;
      contact: ContactMatch;
      propertyId: number | null;
      leadId: number | null;
      ticketId: number | null;
    }
  ): Promise<Task[]>

  // Assignment logic
  async determineAssignee(context: {
    taskType: string;
    department: string | null;
    propertyId: number | null;
    leadId: number | null;
    landlordId: number | null;
    tenantId: number | null;
  }): Promise<number> // userId

  // SLA-based due date calculation
  calculateDueDate(priority: string): Date
}
```

### 3.2 Assignment Rules

```
1. PROPERTY-BASED ASSIGNMENT (highest priority)
   IF task has propertyId:
     → Look up properties.property_manager_id or properties.agent_id
     → Assign to that user

2. LEAD-BASED ASSIGNMENT
   IF task has leadId:
     → Look up leads.assigned_to
     → Assign to that user (if set)

3. LANDLORD-BASED ASSIGNMENT
   IF task relates to a landlord:
     → Find properties WHERE landlord_id = X AND is_managed = true
     → Assign to the property manager of their most recently managed property

4. TICKET-BASED ASSIGNMENT
   IF task relates to a support ticket:
     → Assign to maintenance department (property_manager_id on the ticket's property)

5. DEPARTMENT ROUTING
   IF email came to sales@ → assign to sales team (round-robin)
   IF email came to lettings@ → assign to lettings team (round-robin)
   IF email came to maintenance@ → assign to maintenance team lead

6. ROUND-ROBIN
   Within a department, rotate through active staff with that role:
   → SELECT from staff_role_assignments WHERE role matches department
   → Pick user with fewest open tasks (load balancing)

7. FALLBACK
   → Assign to user with access_level_code = 'general_manager'
```

### 3.3 SLA Due Dates

| Priority | Due Within | Example |
|----------|-----------|---------|
| urgent | 1 hour | Gas leak, flooding, lock-out |
| high | 4 hours | Heating failure in winter, security issue |
| normal | 24 hours | General repair, enquiry response |
| low | 72 hours | Non-urgent admin, document filing |

### 3.4 Task Types Mapped from Email Actions

| Email AI Action | Task Type | Task Title Template |
|----------------|-----------|---------------------|
| create_support_ticket | maintenance | "Maintenance: [AI summary]" |
| create_enquiry | enquiry_response | "Respond to enquiry from [name] re: [property/type]" |
| create_viewing | viewing | "Arrange viewing for [name] at [property]" |
| process_contractor_response | follow_up | "Review contractor response from [name]" |
| route_to_pm | general | "Review email from [name]: [subject]" |
| document received | document | "Review [doc_type] document from [name]" |

### 3.5 Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `server/services/taskAssignmentService.ts` |
| MODIFY | `server/services/email/emailAIAgent.ts` — call taskAssignmentService after each action |
| MODIFY | `shared/schema.ts` — add `sourceEmailId` and `sourceTicketId` to `tasks` table |

---

## Phase 4: Lead Pipeline from Email Enquiries

### 4.1 Enhanced Enquiry → Lead Conversion

**Current flow (broken):**
```
Email enquiry → customerEnquiry record (dead end)
```

**New flow:**
```
Email enquiry
  ├─ Create/update lead in `leads` table
  │   ├─ fullName, email, phone from contact/AI extraction
  │   ├─ source: 'email'
  │   ├─ sourceDetail: department mailbox or 'general'
  │   ├─ leadType: from AI leadDetails (rental/purchase/both)
  │   ├─ Property preferences from AI extraction (budget, bedrooms, areas)
  │   ├─ status: 'new'
  │   ├─ assignedTo: from Assignment Engine
  │   └─ score: initial score based on AI confidence + completeness
  │
  ├─ Match property (if specific property enquired about)
  │   ├─ Search properties by postcode, address fragments, property reference
  │   ├─ Create `lead_property_views` record
  │   └─ Log in `lead_activities`
  │
  ├─ Create lead_communication record
  │   └─ type: 'email', direction: 'inbound', content: email body
  │
  ├─ Create task: "Respond to enquiry from [name]"
  │   └─ assignedTo: from Assignment Engine (lettings/sales agent)
  │
  └─ If specific property → check for available viewings and suggest
```

### 4.2 Property Matching Service

**File:** `server/services/propertyMatchingService.ts`

```typescript
class PropertyMatchingService {
  // Match email content to property records
  async matchProperty(
    address: string | null,
    postcode: string | null,
    propertyReferences: string[],
    department: string | null // sales vs lettings context
  ): Promise<{ propertyId: number; confidence: number } | null>

  // Match lead preferences to available properties
  async matchPropertiesToLead(leadId: number): Promise<{
    propertyId: number;
    matchScore: number;
    matchReasons: string[];
  }[]>
}
```

Matching strategy:
1. Exact property reference (if ID or internal ref mentioned)
2. Postcode + address line partial match
3. Postcode + property type + bedrooms
4. Fallback: flag for manual property assignment

### 4.3 Lead Lifecycle from Email Activity

Track every email interaction to progress leads:

| Email Event | Lead Action |
|------------|-------------|
| Initial enquiry | Create lead (status: 'new') |
| Follow-up from prospect | Update `lastActivityAt`, create activity record |
| Viewing request | Update status: 'viewing_booked', create `lead_viewings` |
| Offer email | Update status: 'offer_made', extract amount |
| No response after 7 days | Auto-task: "Follow up with [lead] — no response" |
| "Not interested" reply | Update status: 'lost', capture `lostReason` from AI |

### 4.4 Cold Lead Capture for Future Marketing

When a lead is lost or goes cold:
- Preserve all contact details and preferences
- Status: 'archived' (not deleted)
- Capture:
  - Property type preferences
  - Budget range
  - Preferred areas
  - Move-in timeline
  - Requirements (pets, parking, garden)
- These leads can be queried for marketing campaigns:
  ```sql
  SELECT * FROM lead
  WHERE status IN ('archived', 'lost')
  AND lead_type = 'rental'
  AND max_budget >= 200000  -- £2,000/month in pence
  AND 'SW1' = ANY(preferred_areas)
  ```

### 4.5 Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `server/services/propertyMatchingService.ts` |
| MODIFY | `server/services/email/emailAIAgent.ts` — replace `handlePropertyEnquiry()` to create leads |
| MODIFY | `server/services/email/emailAIAgent.ts` — add lead activity tracking on follow-up emails |
| ADD | `server/services/leadPipelineService.ts` — lead status progression rules |

---

## Phase 5: Maintenance & Tenant Ticket Automation

### 5.1 Enhanced Ticket Creation

The current `handleSupportRequest` creates tickets but:
- Doesn't create tasks in the task queue
- Doesn't assign to a specific person (just notifies department email)
- Doesn't process attachments (photos of damage, etc.)

**Enhanced flow:**
```
Tenant maintenance email
  ├─ Create support ticket (existing)
  │   ├─ Category from AI (plumbing, electrical, heating, etc.)
  │   ├─ Priority from AI (emergency detection)
  │   └─ Description from AI summary
  │
  ├─ Process attachments (NEW)
  │   ├─ Photos → attach to ticket + upload to property documents
  │   └─ Previous invoices/quotes → attach to ticket
  │
  ├─ Create task (NEW)
  │   ├─ taskType: 'maintenance'
  │   ├─ assignedToId: property's PM (from properties.property_manager_id)
  │   ├─ priority: from AI
  │   ├─ dueDate: SLA-based
  │   ├─ propertyId: from tenant's property
  │   └─ tenantId: contact.id
  │
  ├─ If EMERGENCY (gas/flood/lock-out):
  │   ├─ Create URGENT task
  │   ├─ Send SMS to PM (via Twilio — already integrated)
  │   ├─ Send WhatsApp to maintenance staff (already integrated)
  │   └─ Auto-dispatch to emergency contractor if configured
  │
  └─ Auto-acknowledge tenant (existing)
```

### 5.2 Ticket Queue Integration

All tickets should appear as tasks in the unified task queue:

```
Task queue view:
- "Maintenance: Leaking tap in kitchen" — assigned to Sarah (PM) — HIGH — due in 4h
- "Respond to rental enquiry from John Smith" — assigned to Mike (Lettings) — NORMAL — due in 24h
- "Review KYC document from Mrs Patel" — assigned to Admin — LOW — due in 72h
- "Arrange viewing at 42 Acacia Ave" — assigned to James (Sales) — NORMAL — due in 24h
```

### 5.3 Files to Modify

| File | Change |
|------|--------|
| `server/services/email/emailAIAgent.ts` | After creating ticket, call taskAssignmentService |
| `server/services/email/emailAIAgent.ts` | After creating ticket, call emailAttachmentService |
| `server/services/email/emailAIAgent.ts` | Emergency detection → SMS/WhatsApp notification |

---

## Phase 6: Unified Dashboard & Task Queue UI

### 6.1 Task Queue Page Enhancement

**File:** `client/src/pages/TaskQueue.tsx` (new or enhance `MyDesk.tsx`)

Features:
- All tasks from all sources in one view
- Filter by: assignee, type, priority, status, entity, source
- Sort by due date, priority
- Quick actions: complete, reassign, snooze
- Link to source: click to see original email, ticket, lead
- Real-time updates when new tasks arrive

### 6.2 Email Processing Dashboard Enhancement

**File:** enhance `client/src/pages/AdminInbox.tsx`

Add:
- Document filing status (how many auto-filed, how many need review)
- Lead conversion rate from email enquiries
- Task creation metrics
- Attachment processing queue status

### 6.3 Document Review Queue

**File:** `client/src/pages/DocumentReviewQueue.tsx` (new)

For documents auto-filed from emails with status='pending_review':
- Show document, AI classification, proposed entity
- One-click confirm or reassign to different entity
- Batch approve for high-confidence classifications

---

## Implementation Order

| Phase | What | Dependencies | Scope |
|-------|------|-------------|-------|
| **1** | Enhanced AI prompt + new fields | None | Small — prompt engineering + 2 JSON columns |
| **2** | Attachment download + document filing | Phase 1 | Medium — new service, Graph API method, S3 upload |
| **3** | Task creation + assignment engine | Phase 1 | Medium — new service, assignment rules |
| **4** | Lead pipeline from enquiries | Phase 1, 3 | Medium — property matching, lead creation, pipeline |
| **5** | Enhanced ticket flow + emergency routing | Phase 2, 3 | Small — wire existing services together |
| **6** | Dashboard + task queue UI | Phase 3, 4, 5 | Large — frontend pages |

Phases 2, 3, 4 can be partially parallelized since they have different code paths.

---

## Schema Changes Required

### New columns on `processedEmails`:
```
ai_extracted_tasks          jsonb   -- AI-identified tasks from email
ai_attachment_classifications jsonb -- AI classifications for attachments
ai_property_match           jsonb   -- AI-matched property details
ai_lead_details             jsonb   -- AI-extracted lead qualification data
```

### New columns on `tasks`:
```
source_email_id     integer     -- FK to processed_email.id
source_ticket_id    integer     -- FK to support_ticket.id
source_lead_id      integer     -- FK to lead.id (if task came from lead activity)
sla_deadline        timestamp   -- Calculated SLA due date
```

### New table: `email_attachments` (tracks downloaded attachments)
```
id                  serial PK
processed_email_id  integer NOT NULL    -- FK to processed_email.id
original_filename   text NOT NULL
content_type        text
file_size           integer
storage_url         text                -- Where file was saved
document_id         integer             -- FK to document.id (after filing)
ai_document_type    text                -- AI classification
ai_entity_type      text                -- AI suggested entity type
ai_entity_id        integer             -- AI suggested entity id
ai_confidence       decimal             -- Classification confidence
review_status       text DEFAULT 'pending'  -- 'pending', 'confirmed', 'reassigned', 'rejected'
reviewed_by         integer             -- FK to user.id
reviewed_at         timestamp
created_at          timestamp NOT NULL DEFAULT now()
```

### New table: `assignment_rules` (configurable assignment routing)
```
id                  serial PK
rule_name           text NOT NULL
rule_type           text NOT NULL       -- 'department', 'property_type', 'area', 'task_type'
match_value         text NOT NULL       -- e.g., 'sales', 'SW1', 'maintenance'
assigned_user_id    integer NOT NULL    -- FK to users.id
priority            integer DEFAULT 0   -- Higher = checked first
is_active           boolean DEFAULT true
created_at          timestamp NOT NULL DEFAULT now()
```

---

## New Files Inventory

| File | Phase | Purpose |
|------|-------|---------|
| `server/services/email/emailAttachmentService.ts` | 2 | Download, classify, file attachments |
| `server/services/taskAssignmentService.ts` | 3 | Task creation + intelligent assignment |
| `server/services/propertyMatchingService.ts` | 4 | Match email content to property records |
| `server/services/leadPipelineService.ts` | 4 | Lead status progression from email events |
| `client/src/pages/TaskQueue.tsx` | 6 | Unified task queue view |
| `client/src/pages/DocumentReviewQueue.tsx` | 6 | Document filing review queue |

## Existing Files to Modify

| File | Phase | Change |
|------|-------|--------|
| `server/services/email/emailProcessor.ts` | 1 | Expand AI prompt + response schema |
| `server/services/email/emailAIAgent.ts` | 2-5 | Wire in attachment processing, task creation, lead creation |
| `server/services/microsoft/graphApiClient.ts` | 2 | Add `getAttachmentContent()` method |
| `shared/schema.ts` | 1-3 | New columns + new tables |
| `server/routes/emailIntegrationRoutes.ts` | 6 | Add document review + task queue endpoints |
| `client/src/pages/AdminInbox.tsx` | 6 | Enhanced processing metrics |
| `client/src/components/CRMLayout.tsx` | 6 | Add task queue nav item |

---

## Key Design Decisions

1. **Documents default to `pending_review`** — AI files them automatically but humans confirm. High-confidence classifications (>0.9) can be auto-confirmed.

2. **Every email action creates at least one task** — Nothing falls through the cracks. Even "route_to_pm" creates a task assigned to the PM.

3. **Leads, not just enquiries** — All property enquiries create proper `lead` records in the pipeline, not just `customerEnquiry` records. The existing `customerEnquiry` table becomes a lightweight log while `leads` is the pipeline.

4. **Assignment is rule-based, not AI-based** — AI classifies; deterministic rules assign. This is auditable and adjustable without retraining.

5. **Attachment processing is async** — Download and classification happens in the job queue to avoid blocking email processing. The email gets a task immediately; documents follow.

6. **Emergency SMS/WhatsApp uses existing Twilio integration** — No new infrastructure needed for urgent notifications.

7. **All monetary values remain in pence (integer)** — Consistent with existing convention.

8. **Idempotency preserved** — The existing `processedEmails.graphMessageId` check prevents duplicate processing. Extended to attachment downloads.
