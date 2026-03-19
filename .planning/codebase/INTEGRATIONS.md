# External Integrations

**Analysis Date:** 2026-03-19

## APIs & External Services

**AI / LLM:**
- OpenAI GPT-4o - AI property search, email classification, natural language query parsing, address generation
  - SDK: `openai` npm package
  - Client: `server/lib/openaiClient.ts`
  - Used in: `server/openai.ts`, `server/emailService.ts`, `server/aiPropertySearch.ts`, `server/aiPropertyParser.ts`, `server/agents/`
  - Auth: `OPENAI_API_KEY` env var
- Anthropic Claude - Configured as optional AI provider
  - Auth: `ANTHROPIC_API_KEY` env var (key configured, no SDK imported)
- Google Gemini - Configured as optional AI provider
  - Auth: `GEMINI_API_KEY` env var (key configured, no SDK imported)
- Retell AI - Voice AI receptionist / phone agent
  - Client: custom HTTP calls in `server/voiceAgentService.ts`
  - Auth: `RETELL_API_KEY`, `RETELL_AGENT_ID`, `RETELL_WEBHOOK_URL` env vars
  - Webhook: receives callbacks at `/api/voice/retell-webhook`

**Communications:**
- Twilio - SMS and WhatsApp messaging
  - SDK: `twilio` npm package
  - SMS service: `server/smsService.ts`
  - WhatsApp service: `server/whatsappService.ts`
  - Auth: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `TWILIO_WHATSAPP_NUMBER` env vars
  - Webhooks: incoming calls at `/api/webhooks/twilio` and `/api/webhooks/twilio/voice`, SMS at `/api/webhooks/twilio/sms`
- WhatsApp Business API (Meta) - Direct WhatsApp Business integration (separate from Twilio WhatsApp)
  - Auth: `WHATSAPP_BUSINESS_PHONE_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN` env vars
  - Webhook: `/api/webhooks/whatsapp`
- SendGrid - Transactional email (imported, may be secondary to SMTP)
  - SDK: `@sendgrid/mail` npm package
  - Auth: `SENDGRID_API_KEY` env var (not in .env.example, may be unused)

**Document Signing:**
- DocuSign - Electronic signature for tenancy agreements
  - Service: `server/docusignService.ts`
  - Auth: `DOCUSIGN_INTEGRATION_KEY`, `DOCUSIGN_SECRET_KEY`, `DOCUSIGN_ACCOUNT_ID`, `DOCUSIGN_USER_ID`, `DOCUSIGN_ENVIRONMENT` env vars
  - OAuth: Authorization Code Grant flow
  - Webhook: `/api/webhooks/docusign`

**Payments:**
- Stripe - Payment processing (rent, deposits)
  - SDK: `stripe` npm package (v20.0.0), `@stripe/react-stripe-js`, `@stripe/stripe-js` for frontend
  - Service: `server/paymentService.ts`
  - Auth: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` env vars
  - API version: `2025-11-17.clover`
  - Webhook: `/api/webhooks/stripe`
- GoCardless - Direct Debit for recurring rent collection
  - Service: `server/gocardlessService.ts`
  - Client: custom HTTP calls to `api.gocardless.com` / `api-sandbox.gocardless.com`
  - Auth: `GOCARDLESS_ACCESS_TOKEN`, `GOCARDLESS_ENVIRONMENT`, `GOCARDLESS_WEBHOOK_SECRET` env vars

**Property Portals (via Playwright browser automation):**
- Zoopla - Property listing syndication
  - Auth: `ZOOPLA_USERNAME`, `ZOOPLA_PASSWORD`, `ZOOPLA_API_KEY`, `ZOOPLA_BRANCH_ID` env vars
- Rightmove - Property listing syndication
  - Auth: `RIGHTMOVE_USERNAME`, `RIGHTMOVE_PASSWORD`, `RIGHTMOVE_NETWORK_ID`, `RIGHTMOVE_BRANCH_ID` env vars
- OnTheMarket - Property listing syndication
  - Auth: `ONTHEMARKET_USERNAME`, `ONTHEMARKET_PASSWORD` env vars
- PrimeLocation - Property listing syndication
  - Auth: `PRIMELOCATION_USERNAME`, `PRIMELOCATION_PASSWORD` env vars
  - Implementation: `server/portalSyndicationService.ts` uses Playwright (`playwright` npm) to automate portal logins and submissions
  - Credentials stored encrypted (AES encryption) in `portal_credentials` table using `PORTAL_ENCRYPTION_KEY`

**Maps & Location:**
- Google Maps JavaScript API - Interactive property maps on public-facing detail page
  - Used in: `client/src/pages/PropertyDetailPage.tsx` (loaded via `window.google.maps`)
  - Auth: `GOOGLE_MAPS_API_KEY`, `VITE_GOOGLE_MAPS_API_KEY` env vars
- GetAddress.io - UK address lookup by postcode
  - Service: `server/ukPropertyData.ts`
  - Auth: `GETADDRESS_API_KEY` env var
- Postcodes.io - Free postcode validation and geocoding (no API key required)
  - Used in: `server/ukPropertyData.ts`, `server/ukPropertyDataNew.ts`
  - Base URL: `https://api.postcodes.io`
- UK Land Registry (HM Land Registry Price Paid Data) - Historical property price data
  - Used in: `server/ukPropertyDataNew.ts`, `server/ukPropertyData.ts`
  - Auth: `LAND_REGISTRY_API_KEY` env var (optional)
  - Base URL: `landregistry.data.gov.uk`

**Social Media (configured, partially implemented):**
- Facebook / Instagram Business - Lead generation, social mention monitoring, ad campaigns
  - Auth: `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FACEBOOK_PAGE_ACCESS_TOKEN`, `INSTAGRAM_BUSINESS_ID` env vars
  - Webhook: `/api/webhooks/facebook`
- LinkedIn - Social posting / ads
  - Auth: `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_ACCESS_TOKEN` env vars
- Twitter/X - Social posting
  - Auth: `TWITTER_API_KEY`, `TWITTER_API_SECRET`, `TWITTER_ACCESS_TOKEN`, `TWITTER_ACCESS_SECRET`, `TWITTER_BEARER_TOKEN` env vars

**Advertising Platforms (configured, not yet implemented):**
- Google Ads - `GOOGLE_ADS_*` env vars
- Meta Ads - `META_ADS_ACCESS_TOKEN`, `META_ADS_ACCOUNT_ID`, `META_PIXEL_ID` env vars
- Taboola - `TABOOLA_*` env vars
- Outbrain - `OUTBRAIN_*` env vars

## Data Storage

**Databases:**
- PostgreSQL (primary) - All application data
  - Provider: Supabase (cloud-hosted PostgreSQL)
  - Connection: `DATABASE_URL` or `SUPABASE_DATABASE_URL` env var (pooled connection, SSL)
  - Client: `pg` Pool + Drizzle ORM (`server/db.ts`)
  - Schema: `shared/schema.ts` (~6700 lines, source of truth)
- SQLite (secondary, `better-sqlite3`) - Present as dependency, likely for dev/local caching
- Supabase client (`@supabase/supabase-js`) - Present for Supabase-specific features (realtime, storage)
  - Config: `shared/supabase.ts`
  - Auth: `SUPABASE_URL`, `SUPABASE_ANON_KEY` env vars

**File Storage:**
- Local filesystem - Uploaded files stored in `uploads/` directory
  - Property images: `uploads/properties/`
  - CSV imports: `uploads/imports/`
  - Tenancy documents: `uploads/documents/`
  - Handler: multer disk storage configured in `server/crmRoutes.ts`
  - Docker Compose: `uploads/` mounted as named volume for persistence

**Caching:**
- PostgreSQL session store via `connect-pg-simple` (primary, sessions table)
- `memorystore` (fallback in-memory session store)

## Authentication & Identity

**Auth Provider:**
- Custom (Passport.js local strategy)
  - Implementation: `server/auth.ts`
  - Strategy: username + password, hashed with `scrypt` (16-byte salt, 64-byte output)
  - Sessions: PostgreSQL-backed via `connect-pg-simple`, 7-day cookie
  - Frontend timeout: 10-minute inactivity auto-logout (`client/src/hooks/use-auth.tsx`)
  - No third-party OAuth for end-user auth (Supabase Auth SDK not used for this)

## Email Integration

**Primary SMTP/IMAP:**
- Direct SMTP via Nodemailer for sending
  - Service: `server/emailService.ts`, `server/services/email/smtpTransport.ts`
  - Auth: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE`, `SMTP_FROM` env vars
- IMAP polling for receiving (every 5 minutes, started in `server/index.ts`)
  - Service: `server/services/email/imapPollingService.ts`
  - Client: `imapflow` npm package
  - Auth: `IMAP_HOST`, `IMAP_PORT`, `IMAP_USER`, `IMAP_PASSWORD`, `IMAP_TLS` env vars

**Microsoft 365 Email:**
- Microsoft Graph API for Outlook/Exchange email integration
  - Service: `server/services/microsoft/graphApiClient.ts`, `server/services/microsoft/graphAuthService.ts`
  - Permissions: `Mail.Read`, `Mail.ReadWrite`, `Mail.Send`, `User.Read`, `offline_access`
  - Auth: `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID` env vars
  - Token encryption: `EMAIL_TOKEN_ENCRYPTION_KEY` env var (AES, min 32 chars)
  - Routes: `server/routes/emailIntegrationRoutes.ts`

**Email Worker:**
- Background email processing worker runs as separate Docker Compose service
  - Worker: `server/workers/emailWorker.ts`
  - Config: `EMAIL_WORKER_POLL_INTERVAL`, `EMAIL_WORKER_MAX_CONCURRENT` env vars

## Monitoring & Observability

**Error Tracking:**
- None detected (no Sentry, Datadog, etc.)

**Logs:**
- Custom console-based logging via `server/static.ts` `log()` function
- API request logging middleware in `server/index.ts` (method, path, status, duration, response body truncated to 80 chars)
- Service-level `console.log`/`console.error` throughout

## CI/CD & Deployment

**Hosting:**
- Render.io (production) - Frankfurt region, Docker runtime, `render.yaml`
- Replit (also supported) - `.replit` config, Replit vite plugins loaded when `REPL_ID` env present

**CI Pipeline:**
- None detected (no GitHub Actions, CircleCI, etc.)

**Containerization:**
- Docker multi-stage build: `Dockerfile` (production), `Dockerfile.dev` (development)
- `docker-compose.yml` - App service + separate email worker service, shared `uploads` volume

## Environment Configuration

**Required env vars (application will not start without these):**
- `DATABASE_URL` - PostgreSQL connection string (throws hard error in `server/db.ts`)
- `SUPABASE_URL` - Supabase project URL (throws in `shared/supabase.ts`)
- `SUPABASE_ANON_KEY` - Supabase anon key (throws in `shared/supabase.ts`)

**Required for key features:**
- `SESSION_SECRET` - Session signing (falls back to random bytes if missing, breaks sessions on restart)
- `OPENAI_API_KEY` - AI features disabled if missing
- `STRIPE_SECRET_KEY` - Payment features disabled if missing (graceful check in `server/paymentService.ts`)
- `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` - SMS/WhatsApp disabled if missing (graceful check)
- `PORTAL_ENCRYPTION_KEY` - Required for portal credential encryption
- `MICROSOFT_CLIENT_ID` + `MICROSOFT_CLIENT_SECRET` - Microsoft 365 email integration
- `EMAIL_TOKEN_ENCRYPTION_KEY` - Required for storing Microsoft OAuth tokens
- `RETELL_API_KEY` - Voice AI agent

**Secrets location:**
- `.env` file at project root (gitignored)
- `.env.example` documents all variables with format hints

## Webhooks & Callbacks

**Incoming (received by this application):**
- `/api/webhooks/twilio` - Twilio voice/SMS callbacks
- `/api/webhooks/twilio/voice` - Twilio voice call webhook
- `/api/webhooks/twilio/sms` - Twilio SMS webhook
- `/api/webhooks/whatsapp` - WhatsApp Business webhook
- `/api/webhooks/docusign` - DocuSign envelope status events
- `/api/webhooks/stripe` - Stripe payment events (validated with `STRIPE_WEBHOOK_SECRET`)
- `/api/webhooks/facebook` - Facebook/Meta webhook events
- `/api/voice/retell-webhook` - Retell AI voice agent callbacks
- GoCardless webhook endpoint (exact path in `server/gocardlessService.ts`)

**Outgoing (called by this application):**
- Twilio REST API - `api.twilio.com`
- Stripe API - `api.stripe.com`
- GoCardless API - `api.gocardless.com` / `api-sandbox.gocardless.com`
- OpenAI API - `api.openai.com`
- Retell AI API
- Microsoft Graph API - `graph.microsoft.com/v1.0`
- Postcodes.io - `api.postcodes.io`
- GetAddress.io - `api.getaddress.io`
- UK Land Registry - `landregistry.data.gov.uk`
- Property portals (Zoopla, Rightmove, OnTheMarket, PrimeLocation) - via Playwright browser automation

---

*Integration audit: 2026-03-19*
