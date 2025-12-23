# John Barclay CRM - Product Requirements Document (PRD)

**Version:** 2.0
**Date:** December 2024
**Status:** Comprehensive Implementation Complete

---

## Executive Summary

The John Barclay CRM is a comprehensive, full-stack real estate management platform designed for a luxury London-based estate agency. The system serves multiple user roles (agents, landlords, tenants, maintenance staff, administrators) and provides integrated solutions for property sales, rentals, lettings management, maintenance request handling, and advanced customer engagement through multiple communication channels.

**Tech Stack:** React/TypeScript frontend, Express/Node.js backend, PostgreSQL database (Neon), with integrations for Stripe, Twilio, SendGrid, DocuSign, Retell AI, Mapbox, and property portal APIs.

---

## 1. Public-Facing Pages

### 1.1 Marketing & Property Pages

| Page | Route | Description |
|------|-------|-------------|
| Home | `/` | Hero landing with GSAP/Lenis animations, team showcase, testimonials |
| Property Search | `/search`, `/properties` | Advanced search with natural language processing |
| Property Detail | `/property/:id` | Full property info, images, features, inquiry forms |
| Sales | `/sales` | Sales property listings |
| Rentals | `/rentals` | Rental property listings |
| Commercial | `/commercial` | Commercial property hub |
| Commercial Sales | `/commercial-sales` | Commercial sales listings |
| Commercial Lettings | `/commercial-lettings` | Commercial rental listings |
| Investment | `/investment-opportunities` | Investment properties with yield analysis |
| Portfolio Management | `/portfolio-management` | Portfolio tracking tools |
| Valuation | `/valuation` | Property valuation request form |
| Register Rental | `/register-rental` | Landlord property registration |

### 1.2 Area Pages (11 London Areas)

Each area page includes investment analysis, market data, tube station info, and local insights:

- `/areas/bayswater` - Bayswater
- `/areas/harlesden` - Harlesden
- `/areas/kensal-green` - Kensal Green
- `/areas/kensal-rise` - Kensal Rise
- `/areas/kilburn` - Kilburn
- `/areas/ladbroke-grove` - Ladbroke Grove
- `/areas/maida-vale` - Maida Vale
- `/areas/north-kensington` - North Kensington
- `/areas/queens-park` - Queen's Park
- `/areas/westbourne-park` - Westbourne Park
- `/areas/willesden` - Willesden

### 1.3 User Account Pages

| Page | Route | Description |
|------|-------|-------------|
| Login | `/login` | User login |
| Auth | `/auth` | General authentication |
| User Dashboard | `/dashboard` | Personal dashboard |
| Tenant Portal | `/tenant-portal` | Tenant maintenance & info |
| Portal | `/portal` | Portal access hub |
| Payments | `/payments` | Payment management |

---

## 2. CRM & Admin Pages

### 2.1 Core CRM

| Page | Route | Description |
|------|-------|-------------|
| CRM Login | `/crm/login` | Staff login |
| CRM Dashboard | `/crm/dashboard` | Main dashboard with KPIs, stats, activities |
| Property Create | `/crm/properties/create` | AI-powered property listing creation |
| Property Management | `/crm/property-management` | Maintenance, certifications, inspections |
| Workflow Management | `/crm/workflows` | Property lifecycle tracking |

### 2.2 Communication & Engagement

| Page | Route | Description |
|------|-------|-------------|
| Communication Hub | `/crm/communications` | Unified inbox, campaigns |
| Property Syndication | `/crm/syndication` | Portal listing management |
| Calendar | `/crm/calendar` | Scheduling with Google/Outlook sync |

### 2.3 Staff & Users

| Page | Route | Description |
|------|-------|-------------|
| User Management | `/crm/users` | User CRUD, role assignment |
| Staff Management | `/crm/staff` | Employee profiles, attendance, performance |

### 2.4 Analytics & Reporting

| Page | Route | Description |
|------|-------|-------------|
| Analytics | `/crm/analytics` | KPI dashboards, trends |
| Report Builder | `/crm/reports` | Custom report generation |

### 2.5 Advanced Features

| Page | Route | Description |
|------|-------|-------------|
| Voice Agent | `/crm/voice-agent` | Retell AI voice agent management |

---

## 3. Key Components

### 3.1 Property Components

| Component | Purpose |
|-----------|---------|
| `PropertyCard` | Property listing card with map, QR code |
| `PropertyMap` | Mapbox location display |
| `PropertyQRCode` | QR code generation for property boards |
| `PropertySearch` | Advanced search with filters |
| `PropertyChatInterface` | AI conversational property search |
| `BulkPropertyOperations` | CSV import/export (admin only) |

### 3.2 Marketing Components

| Component | Purpose |
|-----------|---------|
| `Hero` | Animated hero sections |
| `Header` / `Footer` | Navigation |
| `FeaturedProperties` | Property carousel |
| `Testimonials` | Customer reviews |
| `ContactSection` | Contact forms |
| `ValuationForm` | Valuation requests |

### 3.3 UI Library

Full shadcn/ui component library including: Accordion, Button, Card, Dialog, Dropdown, Form, Input, Select, Tabs, Toast, Tooltip, and 40+ more components.

---

## 4. Backend Services

### 4.1 Core Services

| Service | File | Purpose |
|---------|------|---------|
| Authentication | `auth.ts` | Passport.js, scrypt password hashing |
| Email | `emailService.ts` | SMTP/IMAP, templates, AI classification |
| SMS | `smsService.ts` | Twilio SMS notifications |
| WhatsApp | `whatsappService.ts` | Twilio WhatsApp messaging |
| Payments | `paymentService.ts` | Stripe integration |
| Voice Agent | `voiceAgentService.ts` | Retell AI phone automation |

### 4.2 Business Logic Services

| Service | File | Purpose |
|---------|------|---------|
| Collaboration Hub | `collaborationHubService.ts` | Unified conversation management |
| Portal Syndication | `portalSyndicationService.ts` | Property portal APIs |
| AI Phone | `aiPhoneService.ts` | Voice interaction handling |
| AI Property Search | `aiPropertySearch.ts` | Natural language search |
| UK Property Data | `ukPropertyDataNew.ts` | Postcode lookup, Land Registry |
| Workflow Automation | `workflowAutomation.ts` | Property lifecycle automation |

### 4.3 API Routes (`crmRoutes.ts`)

**Property Endpoints:**
- `GET/POST /api/crm/properties` - List/Create properties
- `GET/PUT/DELETE /api/crm/properties/:id` - Property CRUD
- `POST /api/crm/properties/:id/images` - Image upload (10MB max)

**Maintenance Endpoints:**
- `GET/POST /api/crm/maintenance` - Maintenance tickets
- `GET /api/crm/contractors` - Contractor list
- `GET /api/crm/certifications` - Property certifications

**Communication Endpoints:**
- `GET/POST /api/crm/conversations` - Conversation management
- `POST /api/crm/campaigns` - Campaign creation

**Portal Endpoints:**
- `GET/POST /api/crm/portals` - Portal credentials
- `POST /api/crm/syndicate` - Syndicate listings

---

## 5. Database Schema

### 5.1 Core Tables

| Table | Purpose |
|-------|---------|
| `users` | User accounts with roles |
| `properties` | Property listings |
| `london_areas` | Area information and market data |

### 5.2 Workflow Tables

| Table | Purpose |
|-------|---------|
| `property_workflows` | Property lifecycle stages |
| `viewing_appointments` | Viewing scheduling |
| `property_offers` | Offer management |
| `contract_documents` | DocuSign documents |

### 5.3 Maintenance Tables

| Table | Purpose |
|-------|---------|
| `maintenance_requests` | Tenant-submitted issues |
| `maintenance_tickets` | AI-routed tickets |
| `work_orders` | Contractor work orders |
| `contractors` | Contractor profiles |
| `property_certifications` | Gas, electrical, EPC tracking |

### 5.4 Staff Tables

| Table | Purpose |
|-------|---------|
| `staff_profiles` | Employee details |
| `staff_attendance` | Time tracking |
| `staff_leave` | Leave management |
| `staff_performance` | KPIs and metrics |
| `staff_training` | Training records |

### 5.5 Communication Tables

| Table | Purpose |
|-------|---------|
| `conversations` | Unified conversations |
| `messages` | Multi-channel messages |
| `campaigns` | Bulk campaigns |
| `campaign_recipients` | Campaign targets |

### 5.6 Customer Tables

| Table | Purpose |
|-------|---------|
| `customer_enquiries` | Lead management |
| `contacts` | Contact records |
| `property_alerts` | Saved searches |
| `saved_properties` | Favorites |
| `support_tickets` | Customer support |

### 5.7 Financial Tables

| Table | Purpose |
|-------|---------|
| `payments` | Payment records |
| `payment_schedules` | Recurring payments |

---

## 6. External Integrations

### 6.1 Payment Processing
- **Stripe** - Card payments, subscriptions, customer management

### 6.2 Communication
- **Twilio** - SMS, WhatsApp, call recording
- **SendGrid** - Email delivery

### 6.3 AI & Voice
- **OpenAI** - Natural language processing, property descriptions
- **Retell AI** - Voice agent automation

### 6.4 Documents
- **DocuSign** - E-signature workflows

### 6.5 Data Services
- **Mapbox** - Maps and location
- **Postcodes.io** - UK postcode lookup
- **Land Registry** - Property price data

### 6.6 Calendar
- **Google Calendar** - Calendar sync
- **Outlook Calendar** - Microsoft calendar sync

### 6.7 Property Portals
- **Zoopla** - Listing syndication
- **Rightmove** - Listing syndication
- **PropertyFinder** - Listing syndication

---

## 7. User Roles & Permissions

| Role | Permissions |
|------|-------------|
| **Admin** | Full system access, user management, configuration |
| **Agent** | Property management, customer handling, viewings |
| **Landlord** | Portfolio view, maintenance oversight, financials |
| **Tenant** | Maintenance requests, payments, property info |
| **Maintenance Staff** | Ticket handling, work orders, inspections |

---

## 8. Key Features

### 8.1 Property Management
- Full property lifecycle (valuation → sale → completion)
- AI-powered property descriptions
- Bulk import/export (CSV)
- QR code generation for property boards
- Map-based location display
- Multi-portal syndication

### 8.2 Maintenance System
- AI-powered ticket routing and prioritization
- Contractor management with certifications
- Work order tracking with photos
- Certification expiry reminders (60/30/7 days)
- Tenant satisfaction tracking

### 8.3 Communication Hub
- Unified inbox (email, SMS, WhatsApp, portal)
- Campaign management with scheduling
- Template system with variables
- Message tracking and analytics

### 8.4 Staff Management
- Employee profiles and certifications
- Attendance and time tracking
- Leave management with approval workflow
- Performance metrics and KPIs
- Training and development tracking
- Commission calculations

### 8.5 Analytics & Reporting
- Real-time KPI dashboards
- Agent performance metrics
- Property performance analysis
- Custom report builder with scheduling
- Multiple export formats (PDF, Excel, CSV)

### 8.6 AI Capabilities
- Natural language property search
- Property description generation
- Lead scoring (1-100)
- Email classification
- Maintenance request routing
- Voice agent interactions

---

## 9. Letting Service Terms

### 9.1 Management Packages

| Package | Fee | Services |
|---------|-----|----------|
| Let Only | 10% | Tenant find, referencing, tenancy agreement |
| Let & Collect | 11% | + Rent collection, statements |
| Full Management | 13% | + Maintenance, inspections, compliance |

### 9.2 Additional Charges

| Service | Price |
|---------|-------|
| Tenancy Administration | £250 |
| Renewal Fee | £150 |
| Property Inspections | £150 |

### 9.3 Certificates & Compliance

| Certificate | Price |
|-------------|-------|
| Gas Safety (CP12) | £120 |
| EICR (Electrical) | £175 |
| EPC Certificate | £95 |
| Floor Plan | £90 |

### 9.4 Professional Services
- Refurbishments (qualified builders, plumbers, electricians)
- Gas safety inspections (Gas Safe registered)
- Plumbing services (Corgi registered)
- Electrical services
- Cleaning services
- Property administration

---

## 10. Environment Configuration

### Required Environment Variables

```env
# Database
DATABASE_URL=postgresql://...

# Authentication
SESSION_SECRET=...

# Email
SMTP_HOST=...
SMTP_PORT=...
SMTP_USER=...
SMTP_PASS=...

# SMS/WhatsApp
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...

# Payments
STRIPE_SECRET_KEY=...
STRIPE_PUBLIC_KEY=...

# AI
OPENAI_API_KEY=...
RETELL_API_KEY=...
RETELL_AGENT_ID=...

# Maps
MAPBOX_TOKEN=...

# Documents
DOCUSIGN_API_KEY=...
```

---

## 11. Technical Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React/TS)                      │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │  Pages  │ │  Hooks  │ │  Utils  │ │   UI    │           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP/WebSocket
┌─────────────────────────┴───────────────────────────────────┐
│                   Backend (Express/Node)                     │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │  Auth   │ │ Routes  │ │Services │ │  Utils  │           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────┐
│                  Database (PostgreSQL/Neon)                  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │  Users  │ │Property │ │Workflow │ │Comms    │           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
└─────────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────┐
│                    External Services                         │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐   │
│  │ Stripe │ │ Twilio │ │ OpenAI │ │DocuSign│ │ Mapbox │   │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 12. Recent Implementations (December 2024)

### 12.1 Property Cards with Maps
- Mapbox static API integration
- Postcode-based coordinate lookup
- Automatic map display on property cards

### 12.2 Bulk Property Operations
- CSV import with progress tracking
- CSV/JSON export functionality
- Admin-only access control
- Template download feature

### 12.3 QR Code Generator
- Unique QR codes per property
- Download (256px, 1024px print quality)
- Print-ready format with branding
- Integrated into PropertyCard component

### 12.4 Staff Management Module
- Complete employee lifecycle management
- Attendance tracking
- Leave management with approval
- Performance metrics
- Training records
- Commission tracking

### 12.5 Letting Service Terms
- Stored in shared data file
- Let Only (10%), Let & Collect (11%), Full Management (13%)
- Professional services catalog
- Tenant terms and conditions
- Certificate pricing

---

## 13. Future Enhancements

- Mobile app for field agents and tenants
- Advanced tenant screening with credit checks
- Property insurance integration
- Automated property valuation using ML
- AR/VR property tours
- Advanced chatbots for 24/7 support
- Predictive analytics for market trends
- Blockchain-based tenancy agreements

---

**Document maintained by:** Development Team
**Last updated:** December 2024
