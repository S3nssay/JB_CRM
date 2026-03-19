# Technology Stack

**Analysis Date:** 2026-03-19

## Languages

**Primary:**
- TypeScript 5.6.3 - Used across entire codebase (client, server, shared)
- CSS (Tailwind) - All styling

**Secondary:**
- SQL (PostgreSQL) - Direct pool queries in some PM/finance routes
- JavaScript (CJS) - Utility/fix scripts at project root (e.g., `fix-deposits.cjs`, `generate-financials.cjs`)

## Runtime

**Environment:**
- Node.js 22 (Alpine in Docker, `FROM node:22-alpine`)
- ESModule format throughout (`"type": "module"` in `package.json`)

**Package Manager:**
- npm (no workspace monorepo)
- Lockfile: `package-lock.json` present

## Frameworks

**Core Backend:**
- Express.js 4.21.2 - HTTP server, all API routes
- Drizzle ORM 0.39.1 - Type-safe PostgreSQL queries (schema at `shared/schema.ts`)
- Passport.js 0.7.0 + passport-local 1.0.0 - Username/password authentication

**Core Frontend:**
- React 18.3.1 - UI framework
- Wouter 3.3.5 - Client-side routing (NOT React Router - critical distinction)
- TanStack React Query 5.60.5 - Server state management and data fetching
- React Hook Form 7.53.1 + Zod 3.23.8 - Form handling and validation

**UI Components:**
- Radix UI (full suite) - Accessible primitives (accordion, dialog, select, tabs, etc.)
- shadcn/ui pattern - Components built on Radix, located in `client/src/components/ui/`
- Tailwind CSS 3.4.14 - Utility-first styling
- tailwind-merge, class-variance-authority - Class composition utilities
- Framer Motion 11.18.2 - Animations
- GSAP 3.13.0 - Advanced animations
- Lenis 1.3.11 - Smooth scrolling

**3D / Visualization:**
- Three.js 0.182.0 + @react-three/fiber + @react-three/drei - 3D rendering
- Recharts 2.13.0 - Charts and data visualization

**Testing:**
- Playwright 1.55.0 - End-to-end browser testing

**Build / Dev:**
- Vite 5.4.14 - Frontend bundler and dev server
- esbuild 0.25.0 - Server bundler for production
- tsx 4.21.0 - TypeScript execution for dev server (`npm run dev` → `tsx server/dev.ts`)
- drizzle-kit 0.30.4 - Schema migration tooling

## Key Dependencies

**Critical:**
- `drizzle-orm` 0.39.1 - ORM; schema is the source of truth at `shared/schema.ts`
- `pg` 8.16.3 - Native PostgreSQL client (primary DB driver)
- `@neondatabase/serverless` 0.10.4 - Neon serverless client (also present, for edge contexts)
- `postgres` 3.4.5 - Postgres.js client used in `shared/supabase.ts`
- `connect-pg-simple` 10.0.0 - PostgreSQL session store
- `express-session` 1.18.1 - Session management
- `zod` 3.23.8 - Runtime validation + `drizzle-zod` for schema-derived validators
- `multer` 2.0.2 - File upload handling (disk storage to `uploads/` directory)

**Infrastructure:**
- `twilio` 5.5.1 - SMS and WhatsApp messaging
- `stripe` 20.0.0 - Payment processing
- `nodemailer` 6.10.0 - SMTP email sending
- `imapflow` 1.2.10 - IMAP email polling
- `mailparser` 3.9.3 - Email parsing
- `openai` 4.104.0 - OpenAI GPT-4o integration
- `@sendgrid/mail` 8.1.4 - SendGrid transactional email (imported but SMTP is primary)
- `@supabase/supabase-js` 2.57.4 - Supabase client
- `playwright` 1.55.0 - Portal automation (Zoopla, Rightmove, OnTheMarket scraping)
- `pdf2json` 4.0.0 - PDF parsing for property document import
- `pdfkit` 0.17.2 - PDF generation
- `xlsx` 0.18.5 - Excel file handling
- `uuid` 11.1.0 - UUID generation
- `ws` 8.18.0 - WebSocket support
- `date-fns` 3.6.0 - Date utilities
- `better-sqlite3` 12.5.0 - SQLite (likely for local caching/dev)
- `memorystore` 1.6.7 - In-memory session store (fallback)

## Configuration

**Environment:**
- `.env` file (root) loaded via `dotenv`
- `.env.example` documents all required variables
- Key env vars: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SESSION_SECRET`, `OPENAI_API_KEY`, `TWILIO_*`, `STRIPE_*`, `SMTP_*`, `IMAP_*`, `MICROSOFT_*`, `PORTAL_ENCRYPTION_KEY`, `RETELL_API_KEY`

**Build:**
- `vite.config.ts` - Frontend build, aliases (`@/` → `client/src/`, `@shared/` → `shared/`, `@assets/` → `attached_assets/`)
- `tsconfig.json` - Strict TypeScript, bundler module resolution, same path aliases
- `drizzle.config.ts` - ORM config, reads `SUPABASE_DATABASE_URL` or `DATABASE_URL`, outputs migrations to `./migrations/`
- `tailwind.config.ts` - Tailwind config
- `postcss.config.js` - PostCSS config

**Vite Cache Note:**
- Cache dir set to `C:/temp/vite-johnbarclay` to avoid Dropbox file-locking issues (see `vite.config.ts` line 34)

## Platform Requirements

**Development:**
- Node.js 22
- PostgreSQL (via Supabase cloud)
- `DATABASE_URL` environment variable required (throws if missing)
- Dev server: `npm run dev` → port 5000 (serves both API and Vite HMR)

**Production:**
- Docker (Node 22 Alpine, multi-stage build)
- Deployed on Render.io (Frankfurt region, Docker runtime)
- Port 5000 (only port not firewalled in Render config)
- Uploads stored in `uploads/` volume (mounted via Docker Compose)
- Background email worker runs as separate Docker Compose service (`docker-compose.yml`)

---

*Stack analysis: 2026-03-19*
