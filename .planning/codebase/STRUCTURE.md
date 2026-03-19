# Codebase Structure

**Analysis Date:** 2026-03-19

## Directory Layout

```
JB_CRM/
├── client/                          # Frontend React application (Vite root)
│   └── src/
│       ├── App.tsx                  # Router, providers, all route definitions (~350+ lines)
│       ├── index.css                # Global styles, brand colour variables
│       ├── main.tsx                 # React DOM render entry
│       ├── components/              # Reusable React components
│       │   ├── ui/                  # Shadcn/ui primitives (button, dialog, form, etc.)
│       │   └── *.tsx                # Feature components (CRMLayout, PropertyCard, etc.)
│       ├── pages/                   # ~100 page components (one per route)
│       │   └── areas/               # 11 area-specific public pages
│       ├── hooks/                   # Custom React hooks
│       ├── lib/                     # Client-side utilities and config
│       └── services/                # Client-side API service wrappers
├── server/                          # Backend Express application
│   ├── index.ts                     # Production entry point
│   ├── dev.ts                       # Development entry point (Vite middleware)
│   ├── routes.ts                    # Route registration hub + inline public routes
│   ├── crmRoutes.ts                 # CRM API (~16,766 lines — largest file)
│   ├── financeRoutes.ts             # Finance/invoice/arrears API
│   ├── pmWorkflowRoutes.ts          # Property management workflow API (raw SQL)
│   ├── tenancyOnboardingRoutes.ts   # Tenancy onboarding workflow API
│   ├── salesLettingsRoutes.ts       # Sales/lettings pipeline API
│   ├── accountingRoutes.ts          # Double-entry accounting API
│   ├── tenantRoutes.ts              # Tenant portal API
│   ├── auth.ts                      # Passport.js setup, /api/auth/* endpoints
│   ├── db.ts                        # PostgreSQL pool + Drizzle instance
│   ├── storage.ts                   # Centralised data access (IStorage interface)
│   ├── static.ts                    # Static file serving + log utility
│   ├── vite.ts                      # Vite dev server setup helper
│   ├── schedulerService.ts          # Daily cron: arrears, renewals
│   ├── accountingIntegration.ts     # Accounting event recording
│   ├── workflowAutomation.ts        # Property sales workflow engine
│   ├── agents/                      # AI multi-agent system
│   │   ├── BaseAgent.ts             # Abstract base class
│   │   ├── SupervisorAgent.ts       # Agent selection coordination
│   │   ├── AgentOrchestrator.ts     # Top-level orchestration
│   │   ├── types.ts                 # Shared agent type definitions
│   │   ├── index.ts                 # Barrel export
│   │   └── specialists/             # Domain-specific agent implementations
│   ├── services/                    # Modular service subsystems
│   │   ├── email/                   # IMAP polling, processing, job queue, AI agent
│   │   ├── microsoft/               # Microsoft 365 Graph API client + auth
│   │   ├── messageRouterAgent.ts    # Message routing with Express router
│   │   ├── rentProcessingAgent.ts   # Automated rent processing
│   │   ├── leadPipelineService.ts   # Lead pipeline management
│   │   ├── propertyMatchingService.ts
│   │   └── taskAssignmentService.ts
│   ├── routes/                      # Nested route modules
│   │   └── emailIntegrationRoutes.ts  # Microsoft 365 email endpoints
│   ├── lib/                         # Server-side utilities
│   │   ├── encryption.ts
│   │   └── openaiClient.ts          # OpenAI SDK singleton
│   ├── workers/
│   │   └── emailWorker.ts           # Background email processing worker
│   └── *.ts                         # Domain service files (see below)
├── shared/                          # Shared between client and server
│   ├── schema.ts                    # SOURCE OF TRUTH: Drizzle tables, Zod schemas, TS types (~7,718 lines)
│   ├── supabase.ts                  # Supabase client config
│   └── lettingServiceTerms.ts       # Static letting terms data
├── migrations/                      # Drizzle SQL migration files
│   ├── 0000_handy_the_captain.sql
│   └── email_workflow_automation.sql
├── scripts/                         # Build and utility scripts
├── uploads/                         # File upload storage (committed volume)
├── public/                          # Static assets served directly
├── docs/                            # Documentation files
├── dist/                            # Production build output (gitignored)
│   └── public/                      # Built client assets
├── Dockerfile                       # Production Docker build (Node 22 Alpine)
├── Dockerfile.dev                   # Development Docker build
├── docker-compose.yml               # App + email worker services, uploads volume
├── render.yaml                      # Render.io deployment config
├── drizzle.config.ts                # Drizzle Kit config (migrations)
├── vite.config.ts                   # Vite bundler config (aliases: @/, @shared/, @assets/)
├── tailwind.config.ts               # Tailwind config
├── tsconfig.json                    # TypeScript config (strict mode, ESModules)
└── package.json                     # Scripts: dev, build, start, check, db:push
```

## Directory Purposes

**`client/src/pages/`:**
- Purpose: One file per route — each is a default-exported React component
- Contains: All page components for both public estate agency site and CRM
- Key files:
  - `EstateAgentHome.tsx` — public homepage
  - `CRMDashboard.tsx` — CRM main dashboard
  - `CRMLogin.tsx` — standalone CRM login (no layout)
  - `ManagedPropertyCard.tsx` — managed property detail view
  - `TenancyOnboarding.tsx` — tenancy creation wizard
  - `PMTrackingDashboard.tsx` — property management overview
  - `LandlordDirectory.tsx` — landlord listing and search
  - `AccountingDashboard.tsx` — accounting overview
  - `areas/*.tsx` — 11 location-specific public pages (BayswaterPage, KilburnPage, etc.)

**`client/src/components/`:**
- Purpose: Reusable components shared across pages
- Contains:
  - `ui/` — all shadcn/ui primitives (button, card, dialog, form, input, select, table, toast, etc.)
  - `CRMLayout.tsx` — CRM sidebar shell with collapsible nav sections
  - `PropertyCard.tsx`, `PropertyListingCard.tsx` — property display cards
  - `Header.tsx`, `Footer.tsx` — public site chrome
  - `EnquiryChatbot.tsx` — embedded AI chat widget
  - `AIChat.tsx`, `NaturalLanguageSearch.tsx` — AI search components
  - `ProtectedRoute.tsx` — clearance-based route guard (distinct from `lib/protected-route.tsx`)

**`client/src/hooks/`:**
- Purpose: Custom React hooks
- Key files:
  - `use-auth.tsx` — `AuthProvider`, `useAuth()`, session timeout logic
  - `use-permissions.tsx` — `hasPermission()`, `hasClearance()` based on `user.securityClearance`
  - `use-toast.ts` — toast notification hook
  - `use-mobile.tsx` — mobile breakpoint detection

**`client/src/lib/`:**
- Purpose: Client-side utilities and configuration
- Key files:
  - `queryClient.ts` — TanStack Query client config, `apiRequest()` helper, `getQueryFn()` factory
  - `protected-route.tsx` — `<ProtectedRoute>` component (auth check, redirects to `/auth`)
  - `utils.ts` — `cn()` class name utility (tailwind-merge + clsx)
  - `addressService.ts` — address lookup integration

**`client/src/services/`:**
- Purpose: Client-side service wrappers for complex data operations
- Key files:
  - `propertyData.ts`, `propertyDataService.ts`, `propertyListingsService.ts` — property data fetching helpers
  - `aiPropertySearchService.ts` — client-side AI search service

**`server/agents/specialists/`:**
- Purpose: Domain-specific AI agent implementations
- Contains: `SalesAgent.ts`, `RentalAgent.ts`, `MaintenanceAgent.ts`, `MarketingAgent.ts`, `LeadGenAgent.ts`, `OfficeAdminAgent.ts`
- Pattern: Each extends `BaseAgent`, implements `handleTask()` and `getSystemPrompt()`

**`server/services/email/`:**
- Purpose: Full email processing subsystem
- Key files:
  - `imapPollingService.ts` — polls IMAP every 5 minutes (started from `server/index.ts`)
  - `emailProcessor.ts` — classifies and routes inbound emails
  - `emailSender.ts` — outbound email sending
  - `emailAIAgent.ts` — AI-powered email response drafting
  - `jobQueue.ts` — email processing job queue
  - `smtpTransport.ts` — SMTP transport configuration
  - `subscriptionManager.ts` — email subscription management
  - `webhookHandler.ts` — inbound webhook handling

**`server/services/microsoft/`:**
- Purpose: Microsoft 365 Graph API integration
- Key files:
  - `graphApiClient.ts` — Graph API HTTP client
  - `graphAuthService.ts` — OAuth token management

**`shared/`:**
- Purpose: Isomorphic code consumed by both `client/` and `server/`
- Key file: `schema.ts` — NEVER modify without reading existing definitions first; contains all table schemas, Zod validators, and TypeScript types

## Key File Locations

**Entry Points:**
- `server/dev.ts` — development server (run via `npm run dev`)
- `server/index.ts` — production server (run via `npm start`)
- `client/src/App.tsx` — React app root, all route definitions

**Route Registration:**
- `server/routes.ts` — `registerRoutes()` mounts all sub-routers; also contains inline route handlers for property search, UK land registry, Twilio voice webhooks

**Configuration:**
- `vite.config.ts` — path aliases `@/` → `client/src/`, `@shared/` → `shared/`, `@assets/` → `attached_assets/`
- `drizzle.config.ts` — points to `shared/schema.ts`, outputs migrations to `migrations/`
- `tailwind.config.ts` — brand colours, font config
- `tsconfig.json` — strict mode, ESModule, path aliases mirroring vite aliases

**Core Logic:**
- `shared/schema.ts` — all data models (SOURCE OF TRUTH)
- `server/storage.ts` — `DatabaseStorage` class, singleton `storage` export
- `server/db.ts` — `db` (Drizzle) and `pool` (pg) exports
- `server/auth.ts` — Passport.js setup, session config, `/api/auth/login`, `/api/auth/register`, `/api/logout`
- `server/crmRoutes.ts` — the largest single file; most CRM domain logic lives here
- `client/src/lib/queryClient.ts` — `apiRequest()` helper, React Query config

**Background Services:**
- `server/schedulerService.ts` — arrears detection + renewal reminders (daily, started on server boot)
- `server/services/email/imapPollingService.ts` — IMAP polling (every 5 minutes, started on server boot)
- `server/workers/emailWorker.ts` — background email processing worker (also run as separate Docker service)

## Naming Conventions

**Files:**
- Page components: `PascalCase.tsx` (e.g., `LandlordDirectory.tsx`, `TenancyOnboarding.tsx`)
- Route files: `camelCaseRoutes.ts` (e.g., `crmRoutes.ts`, `financeRoutes.ts`)
- Service files: `camelCaseService.ts` (e.g., `emailService.ts`, `paymentService.ts`)
- Hooks: `use-kebab-case.tsx` (e.g., `use-auth.tsx`, `use-permissions.tsx`)
- UI components: `kebab-case.tsx` inside `components/ui/` (shadcn convention)
- Feature components: `PascalCase.tsx` in `components/`

**Directories:**
- Lowercase for `hooks/`, `lib/`, `services/`, `pages/`, `components/`, `workers/`
- `ui/` subdirectory inside `components/` for primitives only

**Exports:**
- Pages: `export default function PageName()`
- Route routers: `export const crmRouter = Router()` — named exports matching the variable name
- Storage: `export const storage = new DatabaseStorage()` — singleton named export
- Hooks: named exports (`export function useAuth()`, `export function AuthProvider()`)
- Schema: named exports for tables, types, schemas from `shared/schema.ts`

**Route naming pattern:**
- Routers exported from route files are named: `crmRouter`, `financeRouter`, `pmWorkflowRouter`, `tenancyOnboardingRouter`, `slRouter`, `accountingRouter`
- All CRM routers mounted under `/api/crm` in `server/routes.ts`

## Where to Add New Code

**New CRM page:**
1. Create component: `client/src/pages/NewPage.tsx` — default export
2. Add route in `client/src/App.tsx` — BEFORE `<Route path="/crm">` on line ~292
3. Add nav link in `client/src/components/CRMLayout.tsx` under appropriate section

**New CRM API endpoint:**
- Add to `server/crmRoutes.ts` if it fits an existing domain section
- Or create `server/newDomainRoutes.ts`, export a router, import in `server/routes.ts`, mount with `app.use('/api/crm', newRouter)`
- Always check `shared/schema.ts` before referencing any column name

**New database table:**
1. Add table definition to `shared/schema.ts` using `pgTable()`
2. Export the table, Insert/Select types, and Zod insert schema
3. Run `npm run db:push` (interactive) or apply SQL directly via `node -e "..."`
4. Verify column names by querying `information_schema.columns`

**New service (external integration):**
- Create `server/newProviderService.ts` as a class or module with named exports
- Wire into relevant route file or start in `server/index.ts` for background services

**New AI agent specialist:**
1. Create `server/agents/specialists/NewSpecialistAgent.ts` extending `BaseAgent`
2. Implement `handleTask()` and `getSystemPrompt()`
3. Register in `server/agents/AgentOrchestrator.ts`

**New shared utility / type:**
- Shared types/schemas: add to `shared/schema.ts` if database-backed, or create `shared/newUtil.ts` if not
- Client-only utilities: `client/src/lib/newUtil.ts`
- Server-only utilities: `server/lib/newUtil.ts`

**Tests:**
- No test files detected in the codebase — `test-config.ts` exists in `server/` but no test runner config found

## Special Directories

**`uploads/`:**
- Purpose: File upload storage (document attachments, property images)
- Generated: No (persisted user-uploaded files)
- Committed: Mount as Docker volume in production; not committed to git

**`dist/`:**
- Purpose: Production build output
- Generated: Yes (by `npm run build`)
- Committed: No (gitignored)

**`migrations/`:**
- Purpose: Drizzle SQL migration files
- Generated: By `drizzle-kit generate` / `npm run db:push`
- Committed: Yes

**`attached_assets/`:**
- Purpose: Asset files attached during development (PDFs, images referenced via `@assets/` alias)
- Committed: Yes (static reference assets)

**`server/*.ts.tmp.*` files:**
- Purpose: Editor temporary files left over from editing sessions
- These should be cleaned up but are safe to ignore

---

*Structure analysis: 2026-03-19*
