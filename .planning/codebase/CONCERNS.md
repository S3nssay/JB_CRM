# Codebase Concerns

**Analysis Date:** 2026-03-19

---

## Tech Debt

**Massive God-File: crmRoutes.ts (16,766 lines)**
- Issue: A single route file contains 446+ routes spanning properties, tenancies, maintenance, DocuSign, communications, security, staff, payments, leads, contractors, and CMS. It is impossible to review, test, or reason about in isolation.
- Files: `server/crmRoutes.ts`
- Impact: Merge conflicts on every feature branch; cold-start import cost; 9-minute TypeScript check time; any single syntax error breaks the entire CRM API surface.
- Fix approach: Extract domain routers (maintenance, tenancies, security, staff, comms, DocuSign, payments) as separate files matching the pattern already established by `server/accountingRoutes.ts`, `server/financeRoutes.ts`, etc. Mount each at `/api/crm` in `server/routes.ts`.

**Mixed ORM and Raw SQL (No Consistent Data Layer)**
- Issue: The codebase mixes Drizzle ORM (`db.select().from(...)`, `db.insert(...)`) with raw `pool.query(...)` throughout. `server/storage.ts` (2,399 lines) acts as an informal DAO but is bypassed by most route handlers. `server/crmRoutes.ts` alone has 428 uses of `pool.query` or `db.*`.
- Files: `server/crmRoutes.ts`, `server/accountingRoutes.ts`, `server/pmWorkflowRoutes.ts`, `server/storage.ts`
- Impact: Schema column-name bugs are extremely common (documented in CLAUDE.md under "KNOWN WRONG COLUMN NAMES"). Type safety from Drizzle is lost whenever raw SQL is used.
- Fix approach: Standardise on Drizzle ORM for all new queries. Wrap common query patterns in typed service functions in `server/storage.ts` or dedicated service files. Raw SQL only for complex aggregations.

**Deprecated Table References Still in Schema**
- Issue: `shared/schema.ts` still exports deprecated table names (`pm_properties`, `pm_landlords`, `pm_tenants`, `pm_tenancies`) — 14 export references. Scripts in `scripts/` reference them (57 total matches across 7 files).
- Files: `shared/schema.ts`, `scripts/drop-legacy-tables.ts`, `scripts/migrate-pm-properties.ts`, `scripts/import-managed-properties.ts`, `scripts/verify-import.ts`
- Impact: Confusion about which table to use. Risk of accidental writes to deprecated tables. The migration scripts exist but the schema exports the old names creating ambiguity.
- Fix approach: Remove deprecated exports from `shared/schema.ts`. Archive migration scripts to a `scripts/archive/` folder.

**Unimplemented Features Returning Placeholder Responses**
- Issue: Several endpoints return success responses but perform no actual database operations. Functionality appears to work but data is silently discarded.
- Files: `server/routes.ts` (lines 2169, 2210, 2237) — property alerts not saved; favourites add/remove/list are stubs returning empty arrays.
- Impact: Users cannot save favourites or property alerts. Any frontend code that relies on these endpoints appears to work but loses data.
- Fix approach: Implement the `favourites` table in `shared/schema.ts`, add DB operations to all three favourite endpoints, and implement alert preference persistence.

**Dormant Script Files in Repository Root**
- Issue: 13+ one-off `.cjs` data-fix scripts and 30+ debug/audit `.ts` and `.js` scripts sit in the repository root. They reference production database credentials at runtime.
- Files: `fix-deposits.cjs`, `fix-deposits2.cjs`, `fix-listed-contacts.cjs`, `fix-rent-collection.cjs`, `fix-rent2.cjs`, `fix-rent3.cjs`, `generate-financials.cjs`, `write-part1.cjs` through `write-part5.cjs`, `audit-database.ts`, `debug-*.ts`, `export-db-data.ts`, etc.
- Impact: Any developer or CI runner who executes these scripts could mutate production data. They pollute the working directory and `git status`. They are not reproducible migrations.
- Fix approach: Delete all one-off scripts. Any needed operations should be proper Drizzle migrations in `migrations/`.

**In-Memory Rate Limiting**
- Issue: The public lead creation endpoint uses a `Map<string, ...>` stored in process memory for rate limiting (`server/routes.ts` lines 1102–1113).
- Files: `server/routes.ts`
- Impact: Rate limit resets on every server restart (including Render.io deploys). In multi-instance deployments the limit is not shared. IP spoofing with `X-Forwarded-For` may bypass it.
- Fix approach: Replace with Redis-backed rate limiting (e.g., `express-rate-limit` + `rate-limit-redis`) or use Supabase as a shared counter store.

**Duplicate DocuSign Callback Route**
- Issue: `crmRouter.get('/docusign/callback', ...)` is registered twice — at line 1523 and line 8425.
- Files: `server/crmRoutes.ts`
- Impact: Express will always invoke the first registration and silently ignore the second. The second implementation may have different/newer logic.
- Fix approach: Remove the duplicate registration, keep the more complete implementation.

---

## Known Bugs

**Silent Empty Catch Blocks Swallow Errors**
- Symptoms: At lines 16140, 16147, 16154, 16171 in `server/crmRoutes.ts`, individual entity-enrichment queries are wrapped in `try { ... } catch (e) {}`. Errors are swallowed without logging.
- Files: `server/crmRoutes.ts` (lines ~16130–16175)
- Trigger: Any schema mismatch, missing column, or DB error during enrichment silently returns empty strings for address/tenant/landlord/tenancy fields.
- Workaround: None — the data is simply absent in the response.

**Session Secret Randomised on Restart**
- Symptoms: `server/auth.ts` line 30: `secret: process.env.SESSION_SECRET || randomBytes(32).toString("hex")`. If `SESSION_SECRET` is not set, a new random secret is generated every process start.
- Files: `server/auth.ts`
- Trigger: Any server restart without `SESSION_SECRET` set invalidates all active sessions and logs out every user.
- Workaround: Set `SESSION_SECRET` env var (documented in CLAUDE.md).

**Lead Token Uses Fallback Secret**
- Symptoms: `server/routes.ts` line 1117: `const secret = process.env.SESSION_SECRET || 'jb-crm-lead-token-secret'`. Falls back to a hardcoded string.
- Files: `server/routes.ts`
- Trigger: Tokens generated with the fallback are cryptographically predictable if an attacker knows the fallback value.
- Workaround: Ensure `SESSION_SECRET` is always set in production.

**Hardcoded Default Password Exposed in Response**
- Symptoms: `server/crmRoutes.ts` line 14656 returns `note: 'Default password is "JohnBarclay2024!" - users should change on first login'` in the API response body.
- Files: `server/crmRoutes.ts`
- Trigger: Calling the staff initialisation endpoint reveals the password in plaintext in the response JSON.
- Workaround: Remove the `note` field from the response.

---

## Security Considerations

**SSL Verification Globally Disabled**
- Risk: `server/index.ts` line 8 and `server/dev.ts` line 8 set `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'`. This disables TLS certificate verification for ALL outbound HTTPS requests from the Node process, including calls to OpenAI, Stripe, Twilio, Supabase, DocuSign, and GoCardless.
- Files: `server/index.ts`, `server/dev.ts`
- Current mitigation: None. The comment says "for UK Land Registry API in development" but it is applied unconditionally in both dev AND production (`index.ts`).
- Recommendations: Remove from `index.ts` entirely. In `dev.ts`, scope it to the specific UK Land Registry client using a custom `https.Agent` with `rejectUnauthorized: false` only for that API call.

**Missing HTTP Security Headers**
- Risk: No `helmet` middleware is imported or applied. The application sends no `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, or `Referrer-Policy` headers.
- Files: `server/index.ts`, `server/routes.ts`
- Current mitigation: None.
- Recommendations: Add `helmet()` as the first middleware in `server/index.ts`. Configure CSP to allow Vite dev server sources in development.

**No CSRF Protection**
- Risk: The session-based auth with cookies has no CSRF token mechanism. Any cross-origin form POST to an authenticated endpoint will be processed.
- Files: `server/auth.ts`, `server/index.ts`
- Current mitigation: None (no `csurf` or `double-submit cookie` pattern).
- Recommendations: Add `csurf` middleware or switch to `SameSite=Strict` cookies (currently not set — defaults to browser behaviour).

**CRM API Routes Not Protected by Auth Middleware at Mount Point**
- Risk: All CRM routes are mounted with `app.use('/api/crm', crmRouter)` with NO authentication middleware at the mount point. Individual route handlers use `requireAgent` or `requireAdmin` ad hoc, but unauthenticated routes exist (e.g., `/demo-email-mode`, `/company-settings`, `/social-credentials`, `/maintenance/tickets`, `/payments/config`, `/payments/create-intent`, `/voice/*`, `/whatsapp/webhook`).
- Files: `server/routes.ts` (line 193), `server/crmRoutes.ts` (lines 134, 159, 215, 4055, 5413, 5429, 6311)
- Current mitigation: Some routes have individual `requireAgent` guards.
- Recommendations: Add a global auth middleware at the `/api/crm` mount point, then explicitly opt-out webhook endpoints (which rely on HMAC verification instead).

**Webhook Endpoints Lack HMAC Signature Verification**
- Risk: Twilio voice webhooks (`/api/voice/inbound`, `/api/voice/process-speech`) and WhatsApp webhooks (`/api/crm/whatsapp/webhook`, `/api/crm/webhooks/whatsapp`) accept and process payloads without verifying Twilio's `X-Twilio-Signature` header.
- Files: `server/routes.ts` (lines 208, 225, 243), `server/crmRoutes.ts` (lines 6395, 9956)
- Current mitigation: None.
- Recommendations: Use `twilio.validateRequest()` middleware on all Twilio webhook endpoints.

**Password Hash in `SELECT *` Queries**
- Risk: Several `db.select().from(users)` calls retrieve the full user row including the `password` column. Some (but not all) callers strip the password before returning. E.g., `storage.ts` line 689 returns all users with passwords.
- Files: `server/storage.ts`, `server/crmRoutes.ts`
- Current mitigation: Partial — `crmRoutes.ts` sanitises the users-list endpoint but internal functions return full rows.
- Recommendations: Create a typed `selectUserPublic` projection excluding `password` from all list/detail queries.

**Hardcoded Default Password in Source Code**
- Risk: `server/crmRoutes.ts` line 14556: `const defaultPassword = 'JohnBarclay2024!'` is a known, committed secret. Any developer with repo access knows the default password for all provisioned staff accounts.
- Files: `server/crmRoutes.ts`
- Current mitigation: A `tempPassword: true` flag is set, which should force a password change on first login, but the enforcement mechanism is not verified.
- Recommendations: Generate a random password per user and email it, or use an invite flow. Remove the hardcoded string from source.

---

## Performance Bottlenecks

**N+1 Queries in Rent Collection Enrichment**
- Problem: `server/crmRoutes.ts` around line 16130–16175 iterates over rent collection records and issues individual `db.select()` calls for property, tenant, landlord, and tenancy inside the loop — four database round-trips per rent record.
- Files: `server/crmRoutes.ts` (lines ~16130–16175)
- Cause: Sequential per-record queries instead of a single JOIN.
- Improvement path: Rewrite as a single SQL query with LEFT JOINs on `properties`, `tenant`, `landlords`, and `tenancies` tables.

**N+1 Queries in Accounting Journal Lines**
- Problem: `server/accountingRoutes.ts` lines 497–504 insert journal lines with a `for` loop issuing one INSERT per line inside a transaction.
- Files: `server/accountingRoutes.ts`
- Cause: Sequential INSERTs instead of a bulk insert.
- Improvement path: Use Drizzle's `db.insert(...).values([...array])` for batch inserts.

**1,296 console.log Calls in Production Code**
- Problem: All server files log extensively with `console.log`/`console.error`/`console.warn`. These are synchronous writes that block the event loop and cannot be disabled in production without code changes.
- Files: 63 files — highest in `server/crmRoutes.ts` (501), `server/routes.ts` (62), `server/accountingRoutes.ts` (58)
- Cause: No structured logging library; plain console calls throughout.
- Improvement path: Adopt `pino` or `winston` with log level filtering. Replace all console calls.

**Playwright-Based Web Scraping at Request Time**
- Problem: `server/propertyImportService.ts` and `server/websiteImportService.ts` launch Playwright browser instances to scrape Rightmove, Zoopla, and johnbarclay.co.uk. These are potentially triggered synchronously on HTTP requests.
- Files: `server/propertyImportService.ts`, `server/websiteImportService.ts`, `server/leadGenerationService.ts`, `server/proactiveLeadGenService.ts`
- Cause: Web scraping is inherently slow (seconds per page) and memory-intensive (Chromium process).
- Improvement path: Move all scraping to background job queues (worker process already exists at `server/workers/emailWorker.ts`). Return a job ID immediately, poll for completion.

**`storage.ts` Monolith (2,399 lines)**
- Problem: All Drizzle-based data access funnels through a single `storage` singleton object. It is imported by every route file, creating a tight coupling and making the 2,399-line file hard to navigate.
- Files: `server/storage.ts`
- Cause: No domain separation — users, properties, tenancies, staff, comms, payments all in one object.
- Improvement path: Split into domain-specific services (e.g., `server/services/propertyService.ts`, `server/services/tenancyService.ts`) over time as areas are refactored.

---

## Fragile Areas

**App.tsx Route Order (Wouter Catch-All)**
- Files: `client/src/App.tsx`
- Why fragile: Wouter's `<Switch>` matches the first route that fits. `<Route path="/crm">` is a generic catch-all. Any new `/crm/*` route added AFTER that line returns a 404. This is documented in the project memory but is still a footgun.
- Safe modification: Always add new CRM routes BEFORE the generic `/crm` route on line ~243. Add a code comment at the catch-all.
- Test coverage: Zero automated tests for routing.

**Dynamic SQL UPDATE Builder in crmRoutes.ts**
- Files: `server/crmRoutes.ts` (lines 170–210 for company settings; `sanitizePropertyUpdates` function at line 539)
- Why fragile: The company settings endpoint builds a raw SQL `UPDATE` by concatenating user-provided field names into a SET clause. While it maps camelCase to snake_case, there is no whitelist validation against actual column names — any injected key would be included if it survives the mapping.
- Safe modification: Validate keys against an explicit allowed-fields whitelist before building the query.
- Test coverage: None.

**Session Store Tied to Database Availability**
- Files: `server/auth.ts`, `server/storage.ts`
- Why fragile: Sessions are stored in PostgreSQL via `connect-pg-simple`. If the database becomes temporarily unavailable, ALL session operations fail, effectively logging out all users.
- Safe modification: Add a Redis session fallback or configure `connect-pg-simple` with a memory cache layer.
- Test coverage: None.

**Scheduler Service Started at Server Boot**
- Files: `server/schedulerService.ts`, `server/index.ts`
- Why fragile: `startScheduler()` is called at server boot. If Render.io auto-scales to multiple instances, arrears detection and renewal reminder jobs will fire multiple times simultaneously, potentially sending duplicate notifications to tenants and landlords.
- Safe modification: Move scheduler to the dedicated `server/workers/emailWorker.ts` container (or use a distributed lock via the database).
- Test coverage: None.

**IMAP Polling Service Runs in Web Process**
- Files: `server/services/email/imapPollingService.ts`, `server/index.ts`
- Why fragile: An IMAP polling loop is started inside the main web server process (`imapPollingService.start(5 * 60 * 1000)`). Long-running IMAP operations can block or crash the HTTP server. Memory leaks in IMAP connections would affect all web requests.
- Safe modification: Move to the dedicated email worker process (`server/workers/emailWorker.ts`, which is already defined in `docker-compose.yml`).
- Test coverage: None.

---

## Scaling Limits

**Database Connection Pool (No Configuration Visible)**
- Current capacity: Default `pg` pool size (10 connections).
- Limit: With 4+ async route files + storage + accounting + PM workflow all sharing `pool` from `server/db.ts`, connection exhaustion is likely under moderate load.
- Scaling path: Configure `max` pool size explicitly in `server/db.ts`. Consider PgBouncer for connection pooling at the infrastructure level (Supabase provides this).

**Monolithic HTTP Process**
- Current capacity: Single Node.js process handles web requests, IMAP polling, scheduler jobs, and Playwright scraping.
- Limit: CPU-bound scraping and AI inference tasks will starve HTTP response handling.
- Scaling path: Docker Compose already defines a separate `email-worker` service. Extend this pattern for scraping and scheduling.

---

## Dependencies at Risk

**`playwright` in Production Image**
- Risk: Playwright + Chromium adds ~400 MB to the Docker image and requires OS-level dependencies. It is used for scraping portals and the agency's own website.
- Impact: Large image size slows deploys; Chromium crashes can take down the process; portal markup changes break scraping silently.
- Migration plan: Use official portal APIs (Rightmove Data Feed, Zoopla Datafeed) where available. For the agency's own site, query the database directly instead of scraping.

**No Package-Level Vulnerability Audit**
- Risk: `package-lock.json` is committed but no automated `npm audit` step exists in CI.
- Impact: Known CVEs in dependencies go undetected.
- Migration plan: Add `npm audit --audit-level=high` to a CI step (GitHub Actions or Render.io pre-deploy hook).

---

## Missing Critical Features

**No Automated Tests**
- Problem: Zero `.test.*` or `.spec.*` files exist anywhere in the codebase. No Jest, Vitest, or any test runner is configured.
- Blocks: Safe refactoring of `crmRoutes.ts` is impossible without a test suite. The 16,766-line route file cannot be split with confidence.
- Priority: High — required before any major refactor.

**No Input Validation on Most Routes**
- Problem: The majority of route handlers in `server/crmRoutes.ts` and `server/accountingRoutes.ts` consume `req.body` fields directly without Zod or express-validator schemas. Only a handful of endpoints (property create, auth register/login) validate input.
- Files: `server/crmRoutes.ts`, `server/accountingRoutes.ts`, `server/pmWorkflowRoutes.ts`
- Risk: Unexpected data types, missing required fields, or oversized payloads can cause runtime errors or silent data corruption.

**Property Alert Preferences Not Persisted**
- Problem: The property alert WhatsApp endpoint (`server/routes.ts` line 2169) sends a message but explicitly TODOs saving preferences to database.
- Blocks: Users cannot receive future matching alerts; the feature is unusable beyond the initial WhatsApp message.

**Favourites Feature is Entirely Stubbed**
- Problem: `/api/favourites` POST and GET both return placeholder responses (`server/routes.ts` lines 2210–2239). No `favourites` table exists in `shared/schema.ts`.
- Blocks: Public-facing saved-property functionality.

---

## Test Coverage Gaps

**All Server Routes**
- What's not tested: Every single API endpoint in `server/crmRoutes.ts`, `server/routes.ts`, `server/accountingRoutes.ts`, `server/financeRoutes.ts`, `server/pmWorkflowRoutes.ts`.
- Files: Entire `server/` directory.
- Risk: Regressions go undetected until a user reports an issue. Column rename, schema change, or logic bug can silently break features.
- Priority: High.

**Auth and Session Logic**
- What's not tested: Login, logout, session expiry, `requireAgent`/`requireAdmin` middleware enforcement, security clearance checks.
- Files: `server/auth.ts`, `server/crmRoutes.ts` (lines 406–455)
- Risk: Privilege escalation bugs (e.g., role check bypasses) would not be caught.
- Priority: High.

**Accounting Double-Entry Integrity**
- What's not tested: The debit=credit validation in `server/accountingIntegration.ts` and `server/accountingRoutes.ts`. Floating-point equality comparison (`totalDebits !== totalCredits`) will fail for values like 100.1 + 200.2 due to IEEE 754 precision.
- Files: `server/accountingIntegration.ts` (line 107), `server/accountingRoutes.ts` (line 478)
- Risk: Journal entries silently rejected or incorrectly created due to floating-point comparison.
- Priority: High — financial data integrity.

**Email and WhatsApp Integrations**
- What's not tested: `server/emailService.ts`, `server/whatsappService.ts`, `server/smsService.ts`, `server/services/email/*`.
- Files: All email/comms service files.
- Risk: Broken templates or send failures go unnoticed until a tenant or landlord reports missing communication.
- Priority: Medium.

---

*Concerns audit: 2026-03-19*
