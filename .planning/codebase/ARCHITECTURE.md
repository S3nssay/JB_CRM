# Architecture

**Analysis Date:** 2026-03-19

## Pattern Overview

**Overall:** Monolithic full-stack TypeScript application with a dual-surface frontend (public estate agency website + private CRM) served from a single Express server on port 5000.

**Key Characteristics:**
- Single Express server handles both API routes and static asset serving (Vite in dev, pre-built in prod)
- Shared schema package (`shared/schema.ts`) is the single source of truth for all data types — consumed by both server and client
- Two distinct UIs live in the same React app: a public-facing estate agency site and an internal CRM, distinguished by route prefix (`/` vs `/crm/`)
- Backend has two query strategies: Drizzle ORM (type-safe, used in `storage.ts` and many route files) and raw SQL via `pool.query` (used heavily in `pmWorkflowRoutes.ts` and `schedulerService.ts`)
- AI agent subsystem runs as a class hierarchy under `server/agents/` alongside the main HTTP layer

## Layers

**Shared Schema:**
- Purpose: Single source of truth for all table definitions, Zod schemas, TypeScript types, and insert/select type exports
- Location: `shared/schema.ts` (~7,718 lines)
- Contains: Drizzle table definitions, Zod validation schemas, exported TypeScript types, domain constants (security clearance levels, role definitions, checklist item types)
- Depends on: Nothing internal
- Used by: Everything — all server route files, `server/storage.ts`, `server/db.ts`, `client/src/hooks/use-auth.tsx`, and frontend form validation

**Database Layer:**
- Purpose: PostgreSQL connection pool + Drizzle ORM instance
- Location: `server/db.ts`
- Contains: `Pool` (pg), `drizzle()` instance exported as `db`, pool exported as `pool` for raw SQL
- Depends on: `DATABASE_URL` env var, `shared/schema.ts`
- Used by: `server/storage.ts`, all route files via direct import of `db` or `pool`

**Storage / Data Access Layer:**
- Purpose: Centralised data access abstraction for common CRUD operations — not all routes use it, but it handles users, properties, invoices, leads, contacts, and more
- Location: `server/storage.ts` (~2,399 lines)
- Contains: `IStorage` interface + `DatabaseStorage` class implementing typed methods; exports singleton `storage`
- Depends on: `server/db.ts`, `shared/schema.ts`, Drizzle ORM operators
- Used by: `server/auth.ts`, `server/routes.ts`, `server/crmRoutes.ts`, `server/financeRoutes.ts`, `server/schedulerService.ts`

**Route Layer:**
- Purpose: Express Router modules grouped by domain, all mounted under `/api/`
- Locations:
  - `server/routes.ts` — main registration hub + public/utility endpoints (~2,406 lines, includes inline route handlers for property search, Twilio webhooks, AI search)
  - `server/crmRoutes.ts` — largest single route file (~16,766 lines), covers all CRM CRUD (properties, landlords, tenants, tenancies, maintenance, compliance, leads, contacts, staff)
  - `server/financeRoutes.ts` — invoices, arrears, rent, bank reconciliation, GoCardless
  - `server/pmWorkflowRoutes.ts` — property management dashboard, rent collection, deposit management, compliance calendars; uses raw SQL throughout
  - `server/tenancyOnboardingRoutes.ts` — tenancy onboarding workflow
  - `server/salesLettingsRoutes.ts` — sales/lettings pipeline
  - `server/accountingRoutes.ts` — double-entry accounting, VAT, journal entries, chart of accounts
  - `server/routes/emailIntegrationRoutes.ts` — Microsoft 365 Graph API email endpoints
  - `server/tenantRoutes.ts` — tenant-specific routes
- Depends on: `server/storage.ts`, `server/db.ts`, `shared/schema.ts`, service files
- Used by: `server/routes.ts` (via `app.use('/api/crm', router)` pattern)

**Service Layer:**
- Purpose: Domain services encapsulating external integrations and complex business logic
- Locations:
  - `server/emailService.ts` — email via Nodemailer/SendGrid
  - `server/whatsappService.ts` — WhatsApp Business API
  - `server/smsService.ts` — Twilio SMS
  - `server/voiceAgentService.ts` — AI voice agent
  - `server/aiPhoneService.ts` — Twilio Voice + OpenAI for inbound calls
  - `server/paymentService.ts` — Stripe
  - `server/gocardlessService.ts` — GoCardless direct debit
  - `server/bankReconciliationService.ts` — bank statement import + reconciliation
  - `server/reconciliationEngine.ts` — payment-to-invoice matching
  - `server/portalSyndicationService.ts` — Rightmove/Zoopla/OnTheMarket syndication
  - `server/leadGenerationService.ts` — lead gen automation
  - `server/workflowAutomation.ts` — property sales workflow engine
  - `server/schedulerService.ts` — daily cron: arrears detection, renewal reminders
  - `server/services/email/` — IMAP polling, email processing, job queue, AI email agent
  - `server/services/microsoft/` — Microsoft 365 Graph API client + auth
  - `server/services/messageRouterAgent.ts` — message routing agent with Express router
  - `server/services/rentProcessingAgent.ts` — automated rent processing
  - `server/accountingIntegration.ts` — accounting entries for rent/fee events
- Depends on: External SDKs, `server/db.ts`, `shared/schema.ts`
- Used by: Route files, `server/index.ts` (for scheduler and IMAP polling startup)

**AI Agent Subsystem:**
- Purpose: Multi-agent system for autonomous task handling across estate agency domains
- Location: `server/agents/`
- Contains:
  - `BaseAgent.ts` — abstract base class with working hours, task capability check, OpenAI invocation
  - `SupervisorAgent.ts` — coordinates specialist agent selection
  - `AgentOrchestrator.ts` — top-level orchestration, routes inbound messages to correct agent
  - `specialists/`: `SalesAgent.ts`, `RentalAgent.ts`, `MaintenanceAgent.ts`, `MarketingAgent.ts`, `LeadGenAgent.ts`, `OfficeAdminAgent.ts`
  - `types.ts` — shared agent type definitions
- Depends on: `server/lib/openaiClient.ts`, `shared/schema.ts`
- Used by: `server/routes/emailIntegrationRoutes.ts`, `server/services/messageRouterAgent.ts`

**Frontend Application:**
- Purpose: React SPA served from `/` — contains both public estate agency site and private CRM
- Location: `client/src/`
- Contains: Pages, components, hooks, lib utilities, services
- Depends on: TanStack Query for server state, Wouter for routing, AuthContext for auth, `shared/schema.ts` for types/validation
- Used by: End users via browser

## Data Flow

**Authenticated CRM Request:**

1. User action in CRM page component (e.g., `client/src/pages/LandlordDirectory.tsx`)
2. `apiRequest()` helper (`client/src/lib/queryClient.ts`) makes `fetch()` with `credentials: "include"`
3. Express middleware validates session via Passport.js (`server/auth.ts`)
4. Request reaches router handler (e.g., `crmRouter` in `server/crmRoutes.ts`)
5. Handler calls `storage.method()` or `db.query()` / `pool.query()` directly
6. JSON response returned to React Query cache
7. Component re-renders with fresh data

**Public Property Search:**

1. User types query in `NaturalLanguageSearch` component
2. POST to `/api/parse-query` → `parseWithOpenAI()` in `server/aiPropertySearch.ts` (fallback: `parseBasicQuery()` in `server/routes.ts`)
3. Results drive a subsequent GET to `/api/properties` with parsed filters
4. `storage.getProperties()` queries the `properties` table with `is_listed_rental`/`is_listed_sale` flags
5. `PropertyListingsPage` renders results via `PropertyListingCard` components

**Inbound Call Flow:**

1. Twilio calls `/api/voice/inbound` webhook
2. `aiPhone.handleInboundCall()` (`server/aiPhoneService.ts`) generates TwiML
3. Caller speech → `/api/voice/process-speech` → OpenAI for intent parsing
4. Lead/contact record created or updated in DB
5. TwiML response returned to Twilio

**State Management:**
- Server state: TanStack React Query with `staleTime: Infinity` and no background refetch (explicit invalidation on mutations)
- Auth state: React Context (`AuthProvider` in `client/src/hooks/use-auth.tsx`) — single `/api/user` query, 10-minute inactivity timeout via `localStorage`
- UI state: Component-local `useState` — no Redux or global UI store
- CRM sidebar auth: `CRMLayout.tsx` reads from `localStorage` ('user' key) independently of the `AuthProvider` context — dual auth tracking pattern

## Key Abstractions

**`storage` singleton:**
- Purpose: Typed data access object hiding Drizzle query details from route files
- Examples: `storage.getLandlords()`, `storage.createTenancy()`, `storage.getAllInvoices()`
- Pattern: Interface (`IStorage`) + class (`DatabaseStorage`) exported as singleton from `server/storage.ts`

**`apiRequest()` helper:**
- Purpose: Typed fetch wrapper that always sends `credentials: "include"` and throws on non-OK responses
- Examples: `apiRequest('/api/crm/landlords')`, `apiRequest('POST', '/api/crm/properties', data)`
- Pattern: Overloaded function in `client/src/lib/queryClient.ts`, accepts both `(url, method, data)` and `(url, options)` signatures

**`CRMLayout` wrapper:**
- Purpose: Persistent sidebar navigation shell for all CRM pages
- Examples: All `/crm/*` routes in `client/src/App.tsx` wrap their page component: `<CRMLayout><PageComponent /></CRMLayout>`
- Pattern: Wrapper component at `client/src/components/CRMLayout.tsx` with collapsible nav sections (PM, Sales/Lettings, Accounting, Admin)

**`BaseAgent` abstract class:**
- Purpose: Common agent behaviour — OpenAI invocation, working hours check, task routing
- Examples: `SalesAgent extends BaseAgent`, `MaintenanceAgent extends BaseAgent`
- Pattern: Abstract class at `server/agents/BaseAgent.ts`; specialists override `handleTask()` and `getSystemPrompt()`

**Drizzle Schema Types:**
- Purpose: Insert/select TypeScript types derived from table definitions — shared between server and client
- Examples: `Landlord`, `InsertLandlord`, `Property`, `InsertProperty`, `Tenancy`, `InsertTenancy`
- Pattern: Exported from `shared/schema.ts`; frontend forms use Zod schemas from same file for validation

## Entry Points

**Development Server:**
- Location: `server/dev.ts`
- Triggers: `npm run dev` → `tsx server/dev.ts`
- Responsibilities: Creates Express app, calls `registerRoutes()`, attaches Vite dev server middleware with HMR

**Production Server:**
- Location: `server/index.ts`
- Triggers: `node dist/index.js` (after `npm run build`)
- Responsibilities: Creates Express app, calls `registerRoutes()`, serves pre-built static files from `dist/public/`, starts `schedulerService`, starts IMAP polling

**Route Registration:**
- Location: `server/routes.ts`, function `registerRoutes(app)`
- Responsibilities: Calls `setupAuth(app)`, mounts all sub-routers under `/api/crm`, registers Twilio voice webhooks, registers email integration routes, sets up all public API routes inline

**React App:**
- Location: `client/src/App.tsx`
- Responsibilities: Wraps everything in `QueryClientProvider` + `AuthProvider`, renders the `Router()` function which contains the full Wouter `<Switch>` with ~100+ routes
- Critical ordering: Specific CRM sub-routes (e.g., `/crm/tenancy-onboarding`) must appear BEFORE the catch-all `<Route path="/crm">` at line ~292

## Error Handling

**Strategy:** Inconsistent — routes use a mix of patterns.

**Patterns:**
- Route-level try/catch returning `res.status(500).json({ error: 'message' })`; most route handlers follow this pattern
- Global Express error handler in `server/index.ts` and `server/dev.ts`: catches unhandled errors, returns `{ message }` JSON with appropriate status code but also re-throws (causing process log noise)
- Frontend: TanStack Query surfaces errors via `error` state; `apiRequest()` throws `Error` with status code prepended to message; `use-auth.tsx` shows toast notifications on auth mutation failures
- Zod validation: `fromZodError()` used in some routes; raw `ZodError` caught in others

## Cross-Cutting Concerns

**Logging:** `log()` utility from `server/static.ts` — formats `METHOD /path STATUS in Nms :: {response}` for API calls; `console.log/error` used throughout services

**Validation:**
- Server: Zod schemas from `shared/schema.ts` (e.g., `insertPropertySchema.safeParse()`)
- Client: React Hook Form + Zod resolver (`zodResolver()`) on all forms

**Authentication:**
- Server: `req.user` populated by Passport.js session middleware; inline `requireAgent` guards in route files check `req.user` and `req.user.role`
- Client: `useAuth()` hook reads from `AuthContext`; `<ProtectedRoute>` wrapper redirects to `/auth` if no user; `<CRMLayout>` independently checks `localStorage` for CRM sessions

**Security Clearance:**
- `user.securityClearance` numeric field (defined in `shared/schema.ts` as `SECURITY_CLEARANCE_LEVELS`)
- `client/src/hooks/use-permissions.tsx` provides `hasPermission()` / `hasClearance()` hooks
- `client/src/components/ProtectedRoute.tsx` (separate from `lib/protected-route.tsx`) enforces clearance levels on specific routes

---

*Architecture analysis: 2026-03-19*
