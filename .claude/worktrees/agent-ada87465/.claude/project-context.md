# Project Context Memory System

**Last Updated:** 2025-11-21 11:33 AM
**Purpose:** Automated context tracking for Claude Code interactions

---

## Quick Reference

### Project Type
Full-stack real estate management platform (John Barclay Estate & Management)

### Tech Stack
- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS + GSAP + Radix UI
- **Backend:** Node.js + Express + TypeScript + Drizzle ORM
- **Database:** PostgreSQL (Neon Database - serverless)
- **AI:** OpenAI GPT-4 (natural language search, content generation, lead scoring)
- **Authentication:** Passport.js (session-based, scrypt password hashing)
- **Communication:** Twilio (SMS/WhatsApp), SendGrid/Nodemailer (email)
- **Key Libraries:** Framer Motion, Lenis, TanStack Query (React Query), Wouter, React Hook Form

### Current State
- **Website:** Luxury scroll-based homepage with parallax animations
- **CRM:** 65% complete (see IMPLEMENTATION_AUDIT.md)
  - ✅ Complete: User Management, Tenant Portal, Property Maintenance (with AI)
  - 🔨 Partial: Property Management, Workflows, Voice Agent, Communication Hub
  - 🔴 Not Started: Multi-Platform Syndication, Analytics Dashboard
- **Recent:** Property feature filtering system added (Nov 18)
- **Recent:** Property listing cards enhanced with Rightmove-style layout (Nov 18)
- **Git Branch:** main
- **Environment:** Development on Windows (Git Bash)
- **Hosting:** Replit (development and deployment)

---

## Session History

### 2025-11-21 11:33 AM - Fixed Localhost Connection Error
**Changes:**
- Fixed JSX syntax error in `EstateAgentHome.tsx` (unclosed `<Link>` tag at line 1389)
- Started dev server on port 5000
- Verified localhost connection working

**Context:**
User reported localhost couldn't be reached. Investigation found:
1. Dev server wasn't running
2. JSX error preventing compilation (missing `</Link>` closing tag)

**Files Modified:**
- `client/src/pages/EstateAgentHome.tsx` (line 1390 - added `</Link>`)

**Resolution:**
- Dev server now running successfully on http://localhost:5000
- No compilation errors
- Page loading correctly

### 2025-11-21 11:00 AM - Memory System Creation
**Changes:**
- Created `.claude/project-context.md` - Automated memory tracking system
- Created `.claude/session-log.md` - Detailed session history
- Created `.claude/memory-instructions.md` - Usage guide for Claude Code

**Context:**
User requested a memory file system that:
1. Updates after every change
2. Gets looked up after every prompt
3. Maintains project history and context

**Files Modified:**
- `.claude/project-context.md` (created)
- `.claude/session-log.md` (created)
- `.claude/memory-instructions.md` (created)

---

## Active Issues & Priorities

### Current Focus
Memory system setup complete - ready for development

### Known Issues
(From memory.md - documented as of Sep 2025):
1. Navigation display - right-side nav only shows labels on hover (needs permanent visibility)
2. Carousel rotation - not rotating perpetually through postcodes
3. Carousel controls - left/right hover controls not working
4. History section positioning - needs reordering (complex, requires scroll animation adjustments)

### CRM Priority Queue
(From replit.md and IMPLEMENTATION_AUDIT.md):
1. AI Voice Agent - Complete API integration (framework ready)
2. Multi-Platform Syndication - Implement portal APIs (Rightmove, Zoopla, etc.)
3. Communication Hub - Build unified inbox UI
4. Analytics Dashboard - Create visualization components

### General Priority
1. Always read project-context.md at session start
2. Update memory files after each significant change
3. Test builds after code modifications

---

## Important File Locations

### Documentation
- `/.claude/project-context.md` - **START HERE** - Quick reference memory
- `/.claude/session-log.md` - Detailed session history
- `/.claude/memory-instructions.md` - Memory system usage guide
- `/memory.md` - Comprehensive project memory (website + CRM, 748 lines)
- `/PRD.md` - Full product requirements document (2204 lines)
- `/IMPLEMENTATION_AUDIT.md` - CRM implementation status (audit results)
- `/replit.md` - System architecture overview and recent changes

### Key Source Files
- `/client/src/pages/EstateAgentHome.tsx` - Main homepage (scroll animations)
- `/client/src/pages/AreaPage.tsx` - Area detail pages
- `/server/index.ts` - Backend entry point
- `/server/routes/crm.ts` - CRM API routes
- `/db/schema.ts` - Database schema

### Configuration
- `/package.json` - Dependencies and scripts
- `/vite.config.ts` - Frontend build config
- `/drizzle.config.ts` - Database config
- `/.env` - Environment variables (not in git)
- `/.claude/settings.local.json` - Claude Code permissions

---

## Recent Git History

```
5407e81 - Add conditional house characteristics filtering and fix authentication
e878c93 - Add enhanced search panel and new CRM features
fecdd0b - Add hero video to Git LFS
ba7ea7a - John Barclay CRM - Complete system (no videos)
```

---

## Critical Patterns & Conventions

### Scroll Animation System
- Section 2 (History): Horizontal scrolling panels (7 panels total)
- Height calculations use viewport units (vh)
- GSAP ScrollTrigger with Lenis smooth scroll
- Parallax effects throughout

### Database Conventions
- All prices stored in pence (not pounds)
- Timestamps use `createdAt` / `updatedAt`
- User roles: admin, agent, landlord, tenant, maintenance_staff, user
- Property status: active, under_offer, sold, let, withdrawn

### API Routes
- **Public:** `/api/*` (properties, search, areas, enquiries, valuations)
- **CRM (protected):** `/api/crm/*` (requires authentication)
  - Properties: `/api/crm/properties/*`
  - Workflows: `/api/crm/workflows/*`
  - Maintenance: `/api/crm/maintenance/*`
  - Users: `/api/crm/users/*`
- **Auth:** Passport.js with session-based authentication
  - Sessions stored in PostgreSQL (connect-pg-simple)
  - 7-day session duration

### AI Integration Points
- Property search: Natural language queries
- Lead scoring: Automatic priority assignment
- Maintenance routing: AI categorization and contractor matching
- Content generation: Property descriptions and titles

---

## Update Protocol

**When to Update:**
1. After completing any significant code change
2. After discovering important project patterns
3. After resolving bugs or issues
4. After user provides new requirements

**What to Update:**
1. Session History section (add new entry)
2. Active Issues (mark resolved or add new)
3. Recent Git History (if commits made)
4. Quick Reference (if architecture changes)

**How to Update:**
1. Read this file at start of session
2. Edit relevant sections with new information
3. Update "Last Updated" timestamp
4. Keep entries concise and scannable

---

## Notes

- This file should remain < 500 lines for quick parsing
- Detailed history lives in `/memory.md` (748 lines)
- Session details go in `.claude/session-log.md`
- Always check this file before starting work
- Always update this file after completing work
