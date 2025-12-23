# John Barclay Estate & Management Platform
## Complete Product Requirements Document for Antigravity AI

**Version:** 2.0  
**Last Updated:** December 22, 2025  
**Platform Type:** Full-Stack Real Estate Management Platform  
**Domain:** johnbarclay.uk

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Implementation Status](#current-implementation-status)
3. [Technology Stack](#technology-stack)
4. [Public Website](#public-website)
5. [Property Portal & Listings](#property-portal--listings)
6. [CRM & Agent Dashboard](#crm--agent-dashboard)
7. [Rent & Property Management](#rent--property-management)
8. [AI Features](#ai-features)
9. [User Roles & Permissions](#user-roles--permissions)
10. [Database Schema](#database-schema)
11. [API Endpoints](#api-endpoints)
12. [Integrations](#integrations)
13. [Features To Complete](#features-to-complete)
14. [Design System](#design-system)

---

## Executive Summary

John Barclay Estate & Management is a comprehensive luxury real estate platform serving West London's premium property market. The platform combines:

- **Public-Facing Website:** Scroll-based animated landing page with GSAP animations
- **Property Listings:** Sales, rentals, and commercial properties with advanced search
- **CRM System:** Complete agent dashboard for property and client management
- **Property Management:** Landlord/tenant portal with maintenance ticketing
- **AI Features:** Natural language property search, AI chatbot, lead scoring

### Key Value Propositions
- **For Clients:** Premium property search with AI-powered natural language queries, area guides, instant valuations
- **For Agents:** Complete CRM with workflow automation, lead scoring, multi-portal publishing
- **For Landlords:** Automated rent management, maintenance tracking, tenant communication
- **For Tenants:** Self-service portal for maintenance requests, rent payments, document access

### Coverage Areas (14 London Postcodes)
- Bayswater (W2), Harlesden (NW10), Kensal Green (NW10), Kensal Rise (NW10)
- Kilburn (NW6), Ladbroke Grove (W10), Maida Vale (W9), North Kensington (W10)
- Queen's Park (NW6), Westbourne Park (W2), Willesden (NW10)
- Paddington, Notting Hill, St. John's Wood

---

## Current Implementation Status

### Fully Implemented (65%)
- **User Management System:** Complete admin panel with role-based access (admin, agent, landlord, tenant, maintenance_staff, user)
- **Property Listings:** Full CRUD for sales, rentals, commercial properties
- **Public Website:** Scroll-based animated homepage with GSAP, property search pages
- **Maintenance System:** AI-powered ticket triage, contractor matching, certification tracking
- **Tenant Portal:** Full ticket submission and tracking system
- **Property Management Dashboard:** Managed properties list with landlord/tenant information
- **Document Checklist System:** 17-document compliance tracking per property
- **AI Property Search:** Natural language search using OpenAI GPT-4
- **AI Chatbot:** Two floating bubbles - property search (purple) and help chat (gold)

### Partially Implemented (20%)
- **Workflow Management:** Kanban board exists, needs automation rules
- **Voice Agent:** Framework ready, needs OpenAI Real-time API integration
- **Communication Hub:** Email/SMS services exist, needs unified inbox
- **Calendar Integration:** Basic viewing scheduling, needs full calendar sync

### Not Started (15%)
- **Multi-Platform Syndication:** Schema exists, needs Rightmove/Zoopla API integration
- **Analytics Dashboard:** Needs implementation
- **Social Media Auto-Posting:** Needs implementation
- **DocuSign Integration:** Schema exists, needs implementation

---

## Technology Stack

### Frontend
```
Framework: React 18 with TypeScript
Build Tool: Vite
Styling: Tailwind CSS + shadcn/ui components
Animations: GSAP (GreenSock), Framer Motion
Smooth Scroll: Lenis
Forms: React Hook Form + Zod validation
State Management: TanStack Query (React Query v5)
Routing: Wouter
Icons: Lucide React, React Icons
```

### Backend
```
Runtime: Node.js
Framework: Express.js with TypeScript
ORM: Drizzle ORM
Database: PostgreSQL (Neon Database serverless)
Authentication: Passport.js (Local Strategy)
Session Storage: PostgreSQL with connect-pg-simple
Password Hashing: Scrypt with salt
```

### External Services
```
AI: OpenAI GPT-4 (property search, content generation, lead scoring)
Email: SendGrid
SMS: Twilio
Database: PostgreSQL (Replit/Neon)
```

### Key Dependencies
```json
{
  "react": "^18.x",
  "express": "^4.x",
  "drizzle-orm": "latest",
  "@tanstack/react-query": "^5.x",
  "openai": "latest",
  "@sendgrid/mail": "latest",
  "twilio": "latest",
  "gsap": "latest",
  "tailwindcss": "^3.x",
  "passport": "latest",
  "passport-local": "latest"
}
```

---

## Public Website

### Home Page - Scroll-Based Experience

The homepage uses GSAP scroll-triggered animations with a "curtain roll" system:

#### Section Order (by scroll progress)
1. **Hero Section** (0 - 1.2): Logo animation, tagline, coverage area carousel
2. **Properties Section** (1.2 - 4.2): Three panels (Sales/Rentals/Commercial) sliding in
3. **History Section** (4.2 - 7.2): Horizontal scrolling heritage panels
4. **Team Section** (7.2 - 9.0): Team member cards with fade-in
5. **Contact Section** (9.0 - 10.7): Contact form, map, WhatsApp integration

**Total Page Height:** ~10.7 scroll units

#### Brand Colors
```css
--brand-purple: #791E75
--brand-purple-dark: #5d1759
--brand-gold: #F8B324
--brand-gold-dark: #D4A04F
```

### Sales Page (`/sales`)
- Hero with purple background (#791E75)
- Advanced search filters: Postcode, property type, bedrooms, price range
- Contextual filters: House-specific (garden, driveway, garage), Flat-specific (balcony, floor level)
- Property grid with Rightmove-style cards
- Two floating AI bubbles (search + help chat)

### Rentals Page (`/rentals`)
- Similar to Sales with rental-specific filters (furnished status, available from, minimum tenancy)
- Weekly/monthly rent display
- "Register Your Rental" CTA for landlords

### Commercial Page (`/commercial`)
- Premium gold/black styling
- Property types: Offices, Retail, Industrial, Mixed-use
- Square footage prominently displayed
- Business-focused search filters

### Area Pages (14 locations)
Each area page includes:
- Hero with area-specific imagery
- Market overview (average prices, growth statistics)
- Lifestyle information (transport, schools, amenities)
- Featured properties in that area
- Related nearby areas

### Property Detail Page (`/property/:id`)
- Full-width image gallery with thumbnails
- Price, description, specifications
- Features & amenities list
- EPC rating display
- Floor plan download
- Interactive map
- Enquiry form with viewing request
- Similar properties section

### Valuation Page (`/valuation`)
- Multi-step valuation form
- AI-powered address lookup (OpenAI generates realistic UK addresses)
- Property details collection
- Instant online valuation estimate
- Book professional valuation CTA

---

## Property Portal & Listings

### Property Schema
```typescript
{
  id: number (serial primary key)
  listingType: 'sale' | 'rental' | 'commercial'
  status: 'active' | 'under_offer' | 'sold' | 'let' | 'withdrawn'
  title: string
  description: string (AI-enhanced)
  price: number (in pence for precision)
  priceQualifier: string ('guide_price', 'offers_over', 'poa')
  propertyType: 'flat' | 'house' | 'maisonette' | 'penthouse' | 'studio' | 'office' | 'retail'
  bedrooms: number
  bathrooms: number
  receptions: number
  squareFootage: number
  addressLine1: string
  addressLine2: string
  postcode: string
  areaId: number (FK to london_areas)
  tenure: 'freehold' | 'leasehold' | 'share_of_freehold'
  councilTaxBand: string
  energyRating: string (A-G)
  yearBuilt: number
  features: string[] (garden, parking, balcony, etc.)
  amenities: string[]
  images: string[] (array of image URLs)
  floorPlan: string (floor plan image URL)
  propertyManagerId: number (FK to users)
  
  // Rental-specific
  rentPeriod: 'per_month' | 'per_week'
  furnished: 'furnished' | 'unfurnished' | 'part_furnished'
  availableFrom: date
  minimumTenancy: number (months)
  deposit: number
  
  createdAt: timestamp
  updatedAt: timestamp
}
```

### Property Features Schema
```typescript
{
  detached: boolean
  semiDetached: boolean
  frontGarden: boolean
  backGarden: boolean
  driveway: boolean
  garage: boolean
  balcony: boolean
  floorLevel: string
}
```

### Search & Filtering

#### Standard Filters
- Listing type (sale/rental/commercial)
- Property type dropdown
- Price range (min/max)
- Bedrooms (studio, 1, 2, 3, 4, 5+)
- Bathrooms
- Location (postcode or area)

#### House-Specific Filters
- House type dropdown (detached, semi-detached, terraced, end-terrace)
- Garden toggle (yes/no)
- Driveway toggle
- Garage toggle

#### Flat-Specific Filters
- Balcony toggle
- Floor level dropdown (ground, first, second, upper, top)

---

## CRM & Agent Dashboard

### Dashboard Overview (`/crm/dashboard`)

#### Key Metrics
- Today's new leads
- Scheduled viewings today
- Offers received
- Properties under offer
- Month-to-date revenue

#### Quick Actions
- Add new property
- Schedule viewing
- Create new lead
- Send bulk email

### Workflow Management (`/crm/workflows`)

#### Sales Workflow Stages
1. Valuation Requested
2. Instruction (vendor agreement signed)
3. Listed (live on website, portals active)
4. Viewing Stage
5. Offer Received
6. Offer Accepted (solicitor instructed)
7. Exchange of Contracts
8. Completion

#### Lettings Workflow Stages
1. Landlord Instruction
2. Property Listed
3. Tenant Application
4. Referencing
5. Tenancy Agreement
6. Move-In
7. Active Tenancy
8. Renewal/Exit

### Lead Management

#### Enquiry Schema
```typescript
{
  id: number
  source: 'website' | 'phone' | 'email' | 'portal' | 'walk_in'
  sourceDetails: string
  enquiryType: 'viewing' | 'valuation' | 'general' | 'offer'
  customerName: string
  customerEmail: string
  customerPhone: string
  message: string
  leadScore: number (AI-calculated 1-100)
  leadTemperature: 'hot' | 'warm' | 'cold'
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost'
  assignedToId: number (agent ID)
  nextFollowUp: date
  createdAt: date
}
```

### Viewing Management

#### Viewing Schema
```typescript
{
  id: number
  propertyId: number
  viewerName: string
  viewerEmail: string
  viewerPhone: string
  scheduledDate: datetime
  duration: number (minutes, default 30)
  appointmentType: 'in_person' | 'virtual' | 'open_house'
  assignedAgentId: number
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
  feedbackRating: number (1-5)
  feedbackNotes: string
  interestedInOffer: boolean
}
```

### User Management (`/crm/users`)

Complete admin panel with:
- User CRUD operations
- Role assignment (admin, agent, landlord, tenant, maintenance_staff, user)
- Status management (active/inactive)
- Password reset functionality
- Audit logging

---

## Rent & Property Management

### Managed Properties Dashboard

Table view showing:
- Property Address
- Landlord (clickable for details dialog)
- Tenant (clickable for tenancy info)
- Checklist Progress (17-document compliance)
- Management Fee
- Management Period
- Monthly Rent
- Deposit Amount
- Actions (view details, edit)

### Document Checklist (17 items)
1. Signed Tenancy Agreement
2. Proof of ID (Tenant)
3. Proof of ID (Landlord)
4. Right to Rent Check
5. Bank Details
6. Standing Order Form
7. Deposit Certificate
8. EPC Certificate
9. Gas Safety Certificate
10. EICR Certificate
11. Smoke/CO Alarm Test
12. Inventory Check-In
13. Property Photos
14. Key Log
15. Emergency Contacts
16. Utility Readings
17. Insurance Documents

### Landlord Schema
```typescript
{
  id: number
  userId: number (FK to users)
  fullName: string
  email: string
  phone: string
  companyName: string (optional)
  addressLine1: string
  addressLine2: string
  city: string
  postcode: string
  bankName: string
  accountHolderName: string
  notes: string
}
```

### Rental Agreement Schema
```typescript
{
  id: number
  propertyId: number
  landlordId: number
  tenantId: number
  startDate: date
  endDate: date
  monthlyRent: number
  depositAmount: number
  depositProtectionRef: string
  managementFeePercent: decimal
  managementFeeFixed: number
  managementStartDate: date
  managementEndDate: date
  standingOrderSetup: boolean
  standingOrderRef: string
  status: 'active' | 'expired' | 'terminated'
}
```

### Maintenance Ticket System

#### Ticket Schema
```typescript
{
  id: number
  propertyId: number
  tenantId: number
  landlordId: number
  title: string
  description: string
  category: 'plumbing' | 'electrical' | 'heating' | 'appliance' | 'structural' | 'other'
  urgency: 'emergency' | 'urgent' | 'routine' | 'low'
  
  // AI routing
  aiCategorization: string
  aiUrgencyScore: number (1-10)
  aiSuggestedAssignee: number
  aiRoutingReason: string
  
  status: 'new' | 'assigned' | 'in_progress' | 'awaiting_parts' | 'completed' | 'closed'
  assignedToId: number (maintenance staff)
  assignedContractorId: number (external contractor)
  
  images: string[]
  estimatedCost: number
  actualCost: number
  paidBy: 'landlord' | 'tenant' | 'agency'
  resolutionNotes: string
  
  createdAt: date
  resolvedAt: date
}
```

### Contractor Schema
```typescript
{
  id: number
  companyName: string
  contactName: string
  email: string
  phone: string
  specializations: string[] (plumbing, electrical, etc.)
  serviceAreas: string[] (postcodes)
  hourlyRate: number
  rating: decimal
  completedJobs: number
  averageResponseTime: number (hours)
  insuranceExpiry: date
  isActive: boolean
}
```

### Certificate Tracking
- Gas Safety Certificate (annual)
- EPC (10 years)
- EICR (5 years)
- Legionella Risk Assessment (2 years)
- Fire Safety (annual)
- PAT Testing (annual for furnished)

Automated reminders at 90, 60, 30 days before expiry.

---

## AI Features

### 1. AI Property Search

**Endpoint:** `POST /api/search/natural-language`

Powered by OpenAI GPT-4, converts natural language queries to structured search:

```
Input: "3 bed house with garden in Maida Vale under £900k"
Output: {
  propertyType: "house",
  bedrooms: 3,
  location: "Maida Vale",
  maxPrice: 900000,
  features: ["garden"]
}
```

### 2. AI Chatbot (Two Bubbles)

#### Purple Bubble - AI Property Search
- Position: Bottom-right (right-24)
- Icon: Search/magnifying glass
- Function: Natural language property search
- Opens expandable search interface

#### Gold Bubble - Help Chat
- Position: Bottom-right (right-6)
- Icon: Message/chat
- Function: General help and property questions
- Full chat interface with message history

### 3. AI Maintenance Routing

**Endpoint:** `POST /api/ai/assess-maintenance`

Automatically:
- Categorizes ticket (plumbing, electrical, etc.)
- Scores urgency (1-10)
- Suggests contractor
- Estimates cost
- Assigns SLA

### 4. AI Lead Scoring

Analyzes enquiry messages and scores leads:
- Score: 1-100
- Temperature: hot/warm/cold
- Suggested response
- Next action recommendation

### 5. AI Content Generation

- **Property Descriptions:** SEO-optimized, compelling descriptions
- **Property Titles:** Catchy, searchable titles
- **Address Generation:** Real UK addresses from postcodes

---

## User Roles & Permissions

| Feature | Admin | Agent | Landlord | Tenant | Maintenance | User |
|---------|-------|-------|----------|--------|-------------|------|
| View Properties | Yes | Yes | Yes | Yes | No | Yes |
| Create Properties | Yes | Yes | No | No | No | No |
| Edit Properties | Yes | Yes | Own only | No | No | No |
| View Enquiries | Yes | Yes | Own props | No | No | Own only |
| Manage Workflows | Yes | Yes | No | No | No | No |
| View Maintenance | Yes | Yes | Own props | Own only | Assigned | No |
| Create Tickets | Yes | Yes | Yes | Yes | No | No |
| Manage Users | Yes | View only | No | No | No | No |
| Access CRM | Yes | Yes | No | No | No | No |
| Landlord Portal | Yes | No | Yes | No | No | No |
| Tenant Portal | Yes | No | No | Yes | No | No |

---

## Database Schema

### Core Tables (21 total)

1. **users** - All user accounts with roles
2. **properties** - Property listings
3. **london_areas** - Coverage areas (14)
4. **property_portal_listings** - Portal syndication tracking
5. **maintenance_tickets** - Maintenance requests
6. **maintenance_ticket_updates** - Ticket history/comments
7. **maintenance_categories** - AI routing rules
8. **contractors** - Contractor database
9. **staff_profiles** - Employee details
10. **staff_attendance** - Time tracking
11. **staff_leave** - Leave management
12. **staff_performance** - KPIs
13. **staff_training** - Training records
14. **property_workflows** - Sales/lettings workflows
15. **viewing_appointments** - Viewing scheduling
16. **property_offers** - Offer management
17. **contract_documents** - Document storage
18. **customer_enquiries** - Lead tracking
19. **communication_templates** - Email/SMS templates
20. **landlords** - Landlord details
21. **rental_agreements** - Tenancy agreements

---

## API Endpoints

### Public Endpoints
```
GET  /api/properties                    - List properties with filters
GET  /api/properties/:id                - Property details
POST /api/search/natural-language       - AI property search
GET  /api/areas                         - London areas list
GET  /api/areas/:id                     - Area details
POST /api/enquiries                     - Submit enquiry
POST /api/valuations                    - Request valuation
POST /api/viewings                      - Book viewing
```

### CRM Endpoints (Protected)
```
GET    /api/crm/properties              - List all properties
POST   /api/crm/properties              - Create property
PUT    /api/crm/properties/:id          - Update property
DELETE /api/crm/properties/:id          - Delete property
POST   /api/crm/properties/parse        - AI property parser

GET    /api/crm/enquiries               - List enquiries
PUT    /api/crm/enquiries/:id           - Update enquiry

GET    /api/crm/workflows               - Workflow list
POST   /api/crm/workflows               - Create workflow
PUT    /api/crm/workflows/:id           - Update workflow

GET    /api/crm/maintenance/tickets     - Tickets list
POST   /api/crm/maintenance/tickets     - Create ticket
PUT    /api/crm/maintenance/tickets/:id - Update ticket

GET    /api/crm/users                   - User management
POST   /api/crm/users                   - Create user
PUT    /api/crm/users/:id               - Update user

GET    /api/crm/landlords               - List landlords
GET    /api/crm/tenants                 - List tenants
GET    /api/crm/rental-agreements       - List agreements
GET    /api/crm/managed-properties      - Comprehensive property list
GET    /api/crm/contractors             - List contractors
```

### AI Endpoints
```
POST /api/ai/enhance-description        - Generate property description
POST /api/ai/generate-title             - Generate property title
POST /api/ai/generate-addresses         - Generate UK addresses from postcode
POST /api/ai/assess-maintenance         - Assess maintenance ticket
POST /api/ai/score-lead                 - Score enquiry lead
```

---

## Integrations

### Currently Implemented

#### OpenAI (GPT-4)
- Property search parsing
- Content generation
- Maintenance assessment
- Lead scoring
- Address generation

#### SendGrid
- Transactional emails
- Booking confirmations
- Enquiry acknowledgments

#### Twilio
- SMS notifications
- Viewing reminders
- WhatsApp Business API

### To Be Implemented

#### Property Portals
- Rightmove API
- Zoopla API
- OnTheMarket API

#### DocuSign
- Contract signing
- Tenancy agreements
- Digital signatures

#### Social Media
- Facebook auto-posting
- Instagram feed
- LinkedIn

#### Calendar
- Google Calendar sync
- Outlook integration
- iCal exports

---

## Features To Complete

### Priority 1: Voice Agent
- Integrate OpenAI Real-time API
- Phone number provisioning
- Call recording and transcription
- Auto-CRM updates from calls

### Priority 2: Portal Syndication
- Rightmove API integration
- Zoopla API integration
- Sync status tracking
- Analytics per portal

### Priority 3: Communication Hub
- Unified inbox for all channels
- Email/SMS/WhatsApp in one view
- Template management
- Auto-responses

### Priority 4: Analytics Dashboard
- Revenue tracking
- Lead conversion rates
- Property performance
- Agent performance

### Priority 5: Social Media
- Auto-post new listings
- Content calendar
- Engagement tracking
- Multi-platform scheduling

---

## Design System

### Colors
```css
/* Brand Colors */
--brand-purple: #791E75
--brand-purple-dark: #5d1759
--brand-gold: #F8B324
--brand-gold-dark: #D4A04F

/* UI Colors */
--background: white (light) / black (dark pages)
--foreground: gray-900 (light) / white (dark pages)
--card: white with subtle border
--muted: gray-100
```

### Typography
```css
--font-sans: Inter, system-ui
--font-heading: Roboto
```

### Component Library
Using shadcn/ui components:
- Button, Card, Badge
- Dialog, Sheet, Popover
- Form, Input, Select, Checkbox
- Table, Tabs, Accordion
- Toast notifications

### Animations
- GSAP ScrollTrigger for homepage
- Framer Motion for page transitions
- Lenis for smooth scrolling
- CSS transitions for hover states

### Responsive Breakpoints
```css
sm: 640px
md: 768px
lg: 1024px
xl: 1280px
2xl: 1536px
```

---

## Sample Data

The database includes sample data for testing:

### Landlords (5)
- James Worthington
- Sarah Henderson-Clarke
- Michael Chen Holdings Ltd
- Victoria Pemberton
- Robert & Jane Morrison

### Managed Properties (8)
Across West London: Notting Hill, Chelsea, Holland Park, Paddington Basin, Maida Vale, Bayswater, St Johns Wood, Chiswick

### Properties (20+)
Mix of sales, rentals, and commercial across all coverage areas.

---

## Environment Variables Required

```env
# Database
DATABASE_URL=postgresql://...

# OpenAI
OPENAI_API_KEY=sk-...

# SendGrid
SENDGRID_API_KEY=SG....

# Twilio (optional)
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...

# Session
SESSION_SECRET=...

# Supabase (if using)
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
```

---

## Getting Started

1. Clone repository
2. Install dependencies: `npm install`
3. Set up environment variables
4. Push database schema: `npm run db:push`
5. Seed sample data (optional)
6. Start development: `npm run dev`
7. Access at http://localhost:5000

### Default Admin Login
- Username: admin
- Password: [set during seed]

---

## Contact

For questions about this PRD or the existing implementation:
- Domain: johnbarclay.uk
- Platform: Replit

---

*This PRD represents the complete state of the John Barclay Estate & Management platform as of December 22, 2025.*
