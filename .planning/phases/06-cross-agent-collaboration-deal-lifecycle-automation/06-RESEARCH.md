# Phase 6: Cross-Agent Collaboration & Deal Lifecycle Automation - Research

**Researched:** 2026-03-24
**Domain:** Event-driven agent orchestration, deal lifecycle management, real-time CRM notifications
**Confidence:** HIGH

## Summary

This phase wires up inter-agent workflows so that completing one deal stage (tenancy agreed, sale agreed, renewal due, tenancy ending, sale collapsed) automatically triggers downstream agents. The architecture is straightforward because the project already has all the building blocks: pg-boss ^12.14.0 for durable job queues, a fire-and-forget event hook pattern (tenancyEventHooks.ts), ConversationStore for cross-agent conversation access, AuditLogger for timeline data, EscalationService for timeout handling, ChecklistService for document pipelines, and MessageSender for multi-channel contact.

The new work is: (1) a `deals` table as the shared deal record, (2) a `deal_events` table as the event log / timeline source, (3) a `deal_steps` table for pipeline step tracking with dependency ordering, (4) a `notifications` table for in-CRM staff notifications, (5) a DealEventBus service that uses pg-boss send/work to emit and consume domain events, (6) deal pipeline definitions as code (step order, dependencies, agent assignments), (7) new agent tools so specialists can emit deal events and read deal state, (8) CRM UI pages for deal list, deal timeline, and notification bell, and (9) SSE endpoint for real-time notification delivery.

**Primary recommendation:** Use pg-boss as the event transport (already proven in 5+ files), a `deals` + `deal_events` + `deal_steps` schema for the shared deal record, code-defined pipeline templates for each deal type, and SSE for real-time notifications. No new infrastructure needed.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Tenancy agreed pipeline:** Full auto -- Admin auto-generates AST contract, deposit registration task, inventory report request, Right to Rent check. PM gets notified to schedule check-in inspection and sends tenant welcome message with property-specific info from knowledge base plus 2-week check-in scheduled
- **Tenancy ending pipeline:** Admin triggers offboarding checklist + deposit return process. PM triggers checkout inspection + property condition report. Lettings auto-relists property if landlord preference allows
- **Lease approaching renewal (3 months):** Lettings agent contacts tenant to discuss renewal. If agreed, Admin generates new AST. If not renewing, triggers tenancy-ending pipeline
- **Rent review due (annual):** Lettings agent does market comparison, proposes increase to landlord, then communicates to tenant. Admin generates Section 13 notice if needed
- **Sale agreed pipeline:** Admin auto-generates sales memorandum, sends to solicitors on both sides, creates compliance checklist. Lettings agent notified if property was also listed for rent (to delist)
- **Sale falls through pipeline:** Sales agent auto-relists property, notifies previous interested buyers from lead pipeline, Admin cancels in-progress memorandum/compliance tasks
- **Event bus architecture:** pg-boss as event transport, agents emit domain events, other agents subscribe, decoupled
- **Shared deal record:** A deal/transaction record tracks overall lifecycle, each agent reads/writes their status
- **Defined dependencies:** Each deal type has defined step order, tasks fire when prerequisites met
- **Independent parallel work:** Where no dependency, agents work in parallel
- **Staff-configurable steps:** Staff can toggle optional steps on/off per deal
- **Failure handling:** When agent task fails (e.g., incomplete tenant data), originating agent asked to collect missing info, deal pauses
- **Timeouts:** 48hrs no response -> escalate to human staff
- **Cross-referral:** Agents emit cross-referral events creating leads in relevant department
- **Full conversation data flow:** All details captured during agent conversations flow to downstream agents
- **Auto-save to CRM:** Agents auto-write structured data to CRM records
- **Cross-agent conversation access:** Any agent can query full conversation history for a contact across all agent types
- **Inconsistency detection:** Agents compare incoming info against existing CRM data, flag discrepancies to staff
- **Visual deal timeline:** Each deal has a timeline page showing every agent action in order
- **Dedicated Deals section:** Top-level CRM section + timeline widget on property detail page
- **Full staff control:** Pause, skip, manually complete, reassign, cancel -- all logged to audit trail
- **In-CRM notifications:** Notification bell/badge, pipeline events, click to jump to deal timeline

### Claude's Discretion
- Event naming conventions and pg-boss queue structure
- Deal record schema design (tables, columns, relationships)
- Dependency graph representation in code
- Timeline UI component design and layout
- Notification system implementation (polling vs WebSocket vs SSE)
- Cross-agent conversation query API design
- Inconsistency detection algorithm and thresholds

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pg-boss | ^12.14.0 | Event bus / job queue transport | Already used in 5+ files across Phases 2-4. Proven pattern with lazy init. |
| Drizzle ORM | 0.39 | Schema definition and queries for new deal tables | Project ORM, used everywhere |
| Express.js | 4 | New deal routes + SSE endpoint | Project server framework |
| React | 18 | Deal timeline UI, notification bell, deal list page | Project frontend |
| shadcn/ui | latest | UI components for timeline, badges, notifications | Project UI library |
| TanStack React Query | 5 | Server state management for deal data | Project state management |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| EventSource (native) | browser API | Client-side SSE connection | Real-time notification delivery |
| zod4 (npm alias) | 4.x | Agent SDK tool parameter schemas | New deal-related agent tools |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SSE | WebSocket | WebSocket is bidirectional (overkill -- notifications are server-to-client only). SSE auto-reconnects, simpler to implement, works through proxies |
| SSE | Polling | Polling wastes bandwidth and adds latency. SSE is push-based, instant delivery |
| pg-boss | PostgreSQL LISTEN/NOTIFY | LISTEN/NOTIFY is ephemeral (lost if no listener). pg-boss persists jobs, retries failed ones, handles backpressure |
| Code-defined pipelines | Database-stored pipeline definitions | Code pipelines are type-safe, version-controlled, simpler to debug. Staff config is per-deal toggle, not pipeline redesign |

**Installation:**
```bash
# No new packages needed -- all dependencies already installed
# pg-boss ^12.14.0, @openai/agents, shadcn/ui all present
```

## Architecture Patterns

### Recommended Project Structure
```
server/
  agents/
    services/
      dealEventBus.ts          # pg-boss event emission + subscription registration
      dealPipelineService.ts   # Pipeline definitions, step execution, dependency resolution
      dealService.ts           # CRUD for deals, deal events, notifications
    sdk/
      tools.ts                 # Add deal-related tools (emit_deal_event, read_deal_status, etc.)
  dealRoutes.ts                # REST API for deals, timeline, notifications, SSE endpoint
shared/
  schema.ts                    # New tables: deals, deal_events, deal_steps, notifications
client/src/
  pages/
    DealList.tsx               # Top-level deals section
    DealTimeline.tsx           # Individual deal timeline page
  components/
    NotificationBell.tsx       # Header notification icon with badge + dropdown
    DealTimelineWidget.tsx     # Compact timeline for property detail page
  hooks/
    use-notifications.ts       # SSE hook for real-time notifications
    use-deals.ts               # React Query hooks for deal data
```

### Pattern 1: Event Bus via pg-boss
**What:** Domain events emitted as pg-boss jobs, consumed by registered workers that trigger downstream pipeline steps.
**When to use:** Every deal lifecycle transition (tenancy.agreed, sale.agreed, tenancy.ending, etc.)
**Example:**
```typescript
// Source: Existing pg-boss pattern from workOrderFollowup.ts + scheduledMessages.ts

// Event naming convention: {domain}.{action}
// Examples: tenancy.agreed, sale.agreed, sale.collapsed, tenancy.ending,
//           lease.renewal_due, rent_review.due, deal.step_completed

class DealEventBus {
  private boss: PgBoss;
  private started = false;

  async ensureStarted(): Promise<void> {
    if (this.started) return;
    this.boss = new PgBoss(process.env.DATABASE_URL || '');
    await this.boss.start();
    this.started = true;
  }

  // Emit a domain event (fire-and-forget from routes)
  async emit(eventName: string, payload: DealEventPayload): Promise<void> {
    await this.ensureStarted();
    await this.boss.send(`deal-event.${eventName}`, payload);
  }

  // Register a handler for a domain event
  async subscribe(eventName: string, handler: (job: any) => Promise<void>): Promise<void> {
    await this.ensureStarted();
    await this.boss.work(`deal-event.${eventName}`, handler);
  }
}
```

### Pattern 2: Pipeline Definitions as Code
**What:** Each deal type (letting, sale) has a coded pipeline with ordered steps, dependencies, and agent assignments.
**When to use:** Defining what happens after each lifecycle event.
**Example:**
```typescript
// Pipeline step definition
interface PipelineStep {
  id: string;
  name: string;
  agentType: 'admin' | 'lettings' | 'pm' | 'sales';
  dependsOn: string[];       // IDs of steps that must complete first
  isOptional: boolean;        // Staff can toggle off
  timeoutHours: number;       // Default 48
  action: (deal: Deal) => Promise<StepResult>;
}

// Lettings agreed pipeline
const LETTINGS_AGREED_PIPELINE: PipelineStep[] = [
  { id: 'right_to_rent', name: 'Right to Rent Check', agentType: 'admin', dependsOn: [], isOptional: false, timeoutHours: 48, action: ... },
  { id: 'ast_contract', name: 'Generate AST Contract', agentType: 'admin', dependsOn: ['right_to_rent'], isOptional: false, timeoutHours: 48, action: ... },
  { id: 'deposit_registration', name: 'Register Deposit', agentType: 'admin', dependsOn: [], isOptional: false, timeoutHours: 48, action: ... },
  { id: 'inventory_report', name: 'Request Inventory Report', agentType: 'admin', dependsOn: [], isOptional: false, timeoutHours: 48, action: ... },
  { id: 'welcome_message', name: 'Send Tenant Welcome', agentType: 'pm', dependsOn: [], isOptional: false, timeoutHours: 24, action: ... },
  { id: 'checkin_inspection', name: 'Schedule Check-in Inspection', agentType: 'pm', dependsOn: [], isOptional: false, timeoutHours: 48, action: ... },
];
```

### Pattern 3: Fire-and-Forget Event Emission from Routes
**What:** Routes emit events after responding to the client, following the tenancyEventHooks.ts pattern.
**When to use:** Every route that changes deal-relevant state (offer accepted, tenancy created, status changed).
**Example:**
```typescript
// Source: Existing pattern from crmRoutes.ts line 13304

// In the offer acceptance route:
res.json(updatedOffer);

// Fire-and-forget: emit deal event
dealEventBus.emit('sale.agreed', {
  propertyId: offer.propertyId,
  buyerId: offer.buyerId,
  agreedPrice: offer.amount,
  solicitorInfo: offer.metadata?.solicitorInfo,
}).catch(err => console.error('Deal event error:', err));
```

### Pattern 4: SSE for Real-Time Notifications
**What:** Express endpoint streams notifications to connected CRM users via Server-Sent Events.
**When to use:** In-CRM notification bell showing pipeline events.
**Example:**
```typescript
// Express SSE endpoint
router.get('/api/crm/notifications/stream', requireAuth, (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const userId = req.user.id;
  // Store connection reference
  sseClients.set(userId, res);

  req.on('close', () => sseClients.delete(userId));
});

// Push notification to connected user
function pushNotification(userId: number, notification: any) {
  const client = sseClients.get(userId);
  if (client) {
    client.write(`data: ${JSON.stringify(notification)}\n\n`);
  }
}
```

### Pattern 5: Shared Deal Record with Event Log
**What:** A single `deals` row tracks overall state. `deal_events` rows form an append-only timeline. `deal_steps` rows track individual pipeline step status.
**When to use:** All deal operations read/write through the deal record.

### Anti-Patterns to Avoid
- **Direct agent-to-agent calls:** Agents must not call each other directly. Always go through the event bus. This keeps agents decoupled.
- **Storing pipeline definitions in the database:** Pipeline structure belongs in code (type-safe, version-controlled). Only per-deal step toggles (skip/override) go in the database.
- **Blocking routes on downstream processing:** All event emission must be fire-and-forget. The route responds immediately; pipeline processing is async.
- **Creating a new pg-boss instance per event:** Reuse a singleton. The lazy-init pattern is already established in the codebase.
- **Polling for notifications:** Use SSE. Polling wastes resources and adds latency.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Job queue / event transport | Custom event bus with database polling | pg-boss ^12.14.0 | Already in project, handles retries, dead letters, SKIP LOCKED |
| Timeout escalation | Custom timer system | pg-boss delayed jobs + EscalationService | 48hr timeout is just a delayed job, escalation service handles round-robin |
| Multi-channel messaging | Direct Twilio/email calls | MessageSender service | Already handles WhatsApp/SMS/email with truncation and fallback |
| Audit trail / timeline data | Custom logging | AuditLogger + new deal_events table | AuditLogger already logs all agent actions; deal_events adds deal-specific timeline |
| Checklist generation | Manual item creation | ChecklistService | Already generates onboarding/offboarding from meta definitions |
| Conversation history access | Custom query per agent | ConversationStore.getConversationHistory() | Already returns threaded messages for any conversation |
| Staff assignment on escalation | Manual assignment logic | EscalationService with round-robin | Already built, already schedules 30-min follow-ups |
| Real-time push | WebSocket server | SSE (EventSource) | Unidirectional (server -> client), auto-reconnect, simpler than WebSocket |

**Key insight:** This phase is primarily an orchestration layer that connects existing services. The individual agent capabilities (messaging, checklists, escalation, audit) are already built. The new work is the glue: event bus, deal record, pipeline engine, timeline UI.

## Common Pitfalls

### Pitfall 1: pg-boss Instance Proliferation
**What goes wrong:** Each service creates its own `new PgBoss(...)`, leading to multiple database connections and potential conflicts.
**Why it happens:** The lazy-init pattern means each module might start its own boss.
**How to avoid:** Create a singleton DealEventBus that all services share. Export it from one file. Follow the same pattern as `messageSender`, `auditLogger`, `escalationService`.
**Warning signs:** Multiple `[pg-boss]` log lines showing separate start sequences.

### Pitfall 2: Circular Event Loops
**What goes wrong:** Event A triggers event B which triggers event A, creating an infinite loop.
**Why it happens:** Decoupled subscribers don't see the full event chain.
**How to avoid:** Include a `sourceEventId` / `parentDealEventId` in every event payload. Pipeline steps should check deal state before acting (idempotency). Each step should be marked complete before emitting downstream events.
**Warning signs:** Rapidly growing deal_events for a single deal.

### Pitfall 3: Race Conditions on Deal State
**What goes wrong:** Two parallel pipeline steps both read deal state, both try to update, one overwrites the other.
**Why it happens:** Multiple pg-boss workers process events concurrently.
**How to avoid:** Use row-level locking (`SELECT ... FOR UPDATE`) when updating deal state. Or better: each step writes only its own `deal_steps` row, and deal overall status is computed from step states.
**Warning signs:** Steps completing but deal state not reflecting their completion.

### Pitfall 4: Wouter Route Ordering
**What goes wrong:** New `/crm/deals` route is unreachable because the `/crm` catch-all matches first.
**Why it happens:** Wouter `<Switch>` matches top-to-bottom; `/crm` matches all `/crm/*` paths.
**How to avoid:** Add all new routes BEFORE the `<Route path="/crm">` catch-all in App.tsx. This is documented in MEMORY.md as a critical pattern.
**Warning signs:** Navigating to `/crm/deals` shows the default CRM dashboard instead.

### Pitfall 5: SSE Connection Cleanup
**What goes wrong:** Memory leak from SSE connections that are never cleaned up.
**Why it happens:** Client disconnects without `close` event firing (network drop, browser crash).
**How to avoid:** Set a heartbeat interval (every 30s send a comment `:\n\n`). Clean up connections when heartbeat fails. Set a reasonable `sseClients` Map size limit.
**Warning signs:** Growing memory usage, stale entries in sseClients Map.

### Pitfall 6: Missing Schema Check
**What goes wrong:** Code references columns that don't exist in the database.
**Why it happens:** New tables are defined in schema.ts but not pushed to the database.
**How to avoid:** Follow the CLAUDE.md mandatory procedure: check schema -> write code -> verify with live DB query. Always run direct SQL for schema pushes (not `npm run db:push` which is interactive).
**Warning signs:** Runtime errors about undefined columns.

## Code Examples

### Schema: Deal Tables
```typescript
// Source: Designed based on project conventions (pgTable, serial, text, timestamp, etc.)

export const deals = pgTable("deal", {
  id: serial("id").primaryKey(),
  dealType: text("deal_type").notNull(), // 'letting', 'sale', 'renewal', 'end_of_tenancy'
  status: text("status").notNull().default("active"), // 'active', 'paused', 'completed', 'cancelled'
  propertyId: integer("property_id").notNull(),
  // Polymorphic references -- depends on deal type
  tenancyId: integer("tenancy_id"),
  landlordId: integer("landlord_id"),
  tenantId: integer("tenant_id"),
  buyerId: integer("buyer_id"), // lead ID for sales
  // Deal data (JSON for flexibility -- price, solicitor info, conditions, etc.)
  dealData: json("deal_data"),
  // Pipeline tracking
  currentPipeline: text("current_pipeline"), // e.g., 'lettings_agreed', 'sale_agreed'
  // Staff control
  pausedAt: timestamp("paused_at"),
  pausedBy: integer("paused_by"),
  pauseReason: text("pause_reason"),
  cancelledAt: timestamp("cancelled_at"),
  cancelledBy: integer("cancelled_by"),
  cancelReason: text("cancel_reason"),
  completedAt: timestamp("completed_at"),
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const dealSteps = pgTable("deal_step", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull(),
  stepId: text("step_id").notNull(), // matches PipelineStep.id
  stepName: text("step_name").notNull(),
  agentType: text("agent_type").notNull(),
  status: text("status").notNull().default("pending"),
    // 'pending', 'in_progress', 'completed', 'failed', 'skipped', 'timed_out'
  dependsOn: text("depends_on").array(), // step IDs this depends on
  isOptional: boolean("is_optional").default(false),
  isSkipped: boolean("is_skipped").default(false), // staff toggled off
  // Execution
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  failedAt: timestamp("failed_at"),
  failureReason: text("failure_reason"),
  // Timeout
  timeoutAt: timestamp("timeout_at"),
  escalatedAt: timestamp("escalated_at"),
  escalatedTo: integer("escalated_to"),
  // Staff override
  overriddenBy: integer("overridden_by"),
  overriddenAt: timestamp("overridden_at"),
  overrideAction: text("override_action"), // 'skip', 'complete', 'reassign'
  //
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const dealEvents = pgTable("deal_event", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull(),
  eventType: text("event_type").notNull(), // 'step_started', 'step_completed', 'agent_action', 'staff_override', 'escalation', 'message_sent', 'data_captured'
  agentType: text("agent_type"),
  stepId: text("step_id"), // which pipeline step
  // Event details
  title: text("title").notNull(), // Human-readable: "Admin generated AST contract"
  description: text("description"),
  metadata: json("metadata"), // Structured data about the event
  // Actor (agent or staff)
  actorType: text("actor_type").notNull(), // 'agent', 'staff', 'system'
  actorId: integer("actor_id"), // user ID if staff
  //
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const notifications = pgTable("notification", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(), // staff member
  dealId: integer("deal_id"),
  title: text("title").notNull(),
  body: text("body"),
  type: text("type").notNull(), // 'deal_progress', 'escalation', 'cross_referral', 'inconsistency'
  linkUrl: text("link_url"), // e.g., '/crm/deals/123'
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

### Event Naming Convention
```typescript
// Domain events follow the pattern: {domain}.{action}
// All events are pg-boss queue names prefixed with 'deal-event.'

const DEAL_EVENTS = {
  // Lettings lifecycle
  TENANCY_AGREED: 'tenancy.agreed',
  TENANCY_ENDING: 'tenancy.ending',
  LEASE_RENEWAL_DUE: 'lease.renewal_due',
  RENT_REVIEW_DUE: 'rent_review.due',

  // Sales lifecycle
  SALE_AGREED: 'sale.agreed',
  SALE_COLLAPSED: 'sale.collapsed',

  // Pipeline internal
  STEP_COMPLETED: 'deal.step_completed',
  STEP_FAILED: 'deal.step_failed',
  STEP_TIMED_OUT: 'deal.step_timed_out',

  // Cross-referral
  CROSS_REFERRAL: 'deal.cross_referral',
} as const;
```

### SSE Notification Hook
```typescript
// React hook for consuming SSE notifications
function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const eventSource = new EventSource('/api/crm/notifications/stream', {
      withCredentials: true,
    });

    eventSource.onmessage = (event) => {
      const notification = JSON.parse(event.data);
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
    };

    eventSource.onerror = () => {
      // EventSource auto-reconnects by default
      console.warn('[SSE] Connection error, will auto-reconnect');
    };

    return () => eventSource.close();
  }, []);

  return { notifications, unreadCount, markAsRead, markAllAsRead };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Direct function calls between agents | Event-driven via pg-boss job queue | Phase 6 | Decoupled agents, reliable async processing |
| Hardcoded tenancyEventHooks | Generic DealEventBus with pluggable subscribers | Phase 6 | tenancyEventHooks pattern extended to all deal types |
| No deal tracking | Shared deal record with pipeline steps | Phase 6 | Full visibility into multi-agent workflows |
| No real-time notifications | SSE-based in-CRM notification bell | Phase 6 | Staff see pipeline events instantly |

**Existing code to extend (not replace):**
- `tenancyEventHooks.ts` -- currently calls checklistService directly. Phase 6 adds deal event emission alongside existing behavior (dual-write, same as Phase 02-04 pattern)
- `AuditLogger` -- continues to log all agent actions. deal_events table adds deal-specific timeline entries on top
- `ConversationStore` -- already supports cross-conversation queries. New tools surface this to agents

## Open Questions

1. **pg-boss singleton management**
   - What we know: Multiple services currently create their own PgBoss instances (escalationService, scheduledMessages, workOrderFollowup).
   - What's unclear: Whether a shared singleton would conflict with existing lazy-init patterns.
   - Recommendation: Create a new shared `getBoss()` utility that returns a singleton. Existing services can migrate incrementally. DealEventBus uses it from day one.

2. **Inconsistency detection thresholds**
   - What we know: User wants agents to compare incoming info against CRM data and flag discrepancies.
   - What's unclear: What counts as a "discrepancy" (exact match failure? semantic difference? date within range?).
   - Recommendation: Start simple -- exact field comparison for critical fields (rent amount, deposit, pet policy, number of occupants). Flag when agent-captured data differs from CRM record. Staff review resolves.

3. **Contract generation depth**
   - What we know: Pipeline includes "Admin generates AST contract" and "sales memorandum" as steps.
   - What's unclear: CONTRACT-01 through CONTRACT-04 are v2 requirements. How much contract generation to build now vs stub.
   - Recommendation: Stub contract generation steps -- they create a deal event and notification saying "Contract generation pending (v2 feature)". The pipeline step can be marked complete manually by staff. Full generation is v2 scope.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (installed in Phase 1) |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEAL-01 | Event bus emits and routes domain events | unit | `npx vitest run server/agents/services/__tests__/dealEventBus.test.ts -x` | No -- Wave 0 |
| DEAL-02 | Pipeline steps execute in dependency order | unit | `npx vitest run server/agents/services/__tests__/dealPipeline.test.ts -x` | No -- Wave 0 |
| DEAL-03 | Timed-out steps escalate after 48 hours | unit | `npx vitest run server/agents/services/__tests__/dealTimeout.test.ts -x` | No -- Wave 0 |
| DEAL-04 | Staff can pause/skip/complete/cancel deals | integration | `npx vitest run server/__tests__/dealRoutes.test.ts -x` | No -- Wave 0 |
| DEAL-05 | SSE endpoint pushes notifications | integration | `npx vitest run server/__tests__/notificationSSE.test.ts -x` | No -- Wave 0 |
| DEAL-06 | Deal timeline page renders step history | smoke | Manual -- verify UI renders | N/A |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `server/agents/services/__tests__/dealEventBus.test.ts` -- covers DEAL-01
- [ ] `server/agents/services/__tests__/dealPipeline.test.ts` -- covers DEAL-02, DEAL-03
- [ ] `server/__tests__/dealRoutes.test.ts` -- covers DEAL-04
- [ ] `server/__tests__/notificationSSE.test.ts` -- covers DEAL-05

## Sources

### Primary (HIGH confidence)
- Existing codebase: `server/agents/services/tenancyEventHooks.ts` -- fire-and-forget event pattern
- Existing codebase: `server/agents/services/workOrderFollowup.ts` -- pg-boss lazy init and worker pattern
- Existing codebase: `server/agents/services/escalationService.ts` -- timeout escalation and round-robin
- Existing codebase: `server/agents/services/messageSender.ts` -- multi-channel send
- Existing codebase: `server/agents/services/checklistService.ts` -- checklist generation
- Existing codebase: `server/agents/channels/conversationStore.ts` -- conversation history access
- Existing codebase: `server/agents/middleware/auditLogger.ts` -- audit trail logging
- Existing codebase: `server/agents/sdk/tools.ts` -- SDK tool wrapping pattern
- Existing codebase: `server/workflowAutomation.ts` -- existing workflow stage automation
- Existing codebase: `shared/schema.ts` -- all table definitions
- [pg-boss npm](https://www.npmjs.com/package/pg-boss) -- ^12.14.0 API reference
- [pg-boss GitHub](https://github.com/timgit/pg-boss) -- send/work API, pub/sub

### Secondary (MEDIUM confidence)
- [SSE in React notification systems](https://medium.com/@dlrnjstjs/implementing-react-sse-server-sent-events-real-time-notification-system-a999bb983d1b) -- SSE pattern for notification bell
- [SSE implementation guide](https://oneuptime.com/blog/post/2026-01-15-server-sent-events-sse-react/view) -- React EventSource patterns

### Tertiary (LOW confidence)
- None -- all findings verified against existing codebase or official documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project, no new dependencies
- Architecture: HIGH - Extends proven patterns (pg-boss workers, fire-and-forget hooks, audit logger)
- Pitfalls: HIGH - Based on known codebase patterns (wouter routing, pg-boss singleton, schema-first)
- Schema design: MEDIUM - New tables designed following project conventions but not yet validated against live DB
- SSE notifications: MEDIUM - Standard pattern but new to this codebase

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable -- no fast-moving dependencies)
