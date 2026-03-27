# Overview

John Barclay Estate & Management is a comprehensive luxury real estate platform serving West London's premium property market. The platform combines a scroll-based animated public website with a powerful CRM system, AI-powered features, and complete property lifecycle management for sales, rentals, and commercial properties. The application features a React frontend with GSAP animations, Node.js/Express backend, PostgreSQL database, and extensive integrations with property portals, social media, and AI services.

**Full Product Requirements Document:** See `PRD.md` for complete system documentation including all features, API endpoints, database schemas, and integration details.

# Recent Changes

## December 21, 2025 - Advanced Property Search Filters (Redesigned)
- **Redesigned contextual property filters with luxury aesthetic**:
  - Filters ONLY appear when a property type is selected (no more showing all features when none selected)
  - House-specific filters: House type dropdown, Garden/Driveway/Garage toggle pills
  - Flat-specific filters: Balcony toggle pill, Floor level dropdown
  - Sleek pill design with rounded-full styling and semi-transparent backgrounds
  - Selected filters turn brand purple for clear visual feedback
- **Improved backend filtering with keyword normalization**:
  - normalizeFeature helper function handles hyphens, underscores, and case variations
  - Keyword mapping for house types (e.g., "semi detached" matches "semi-detached", "semidetached")
  - Keyword mapping for floor levels (e.g., "ground" matches "ground floor", "ground-floor", "ground level")
  - Searches both features array AND property description for better matching
- **Interactive property image galleries**:
  - PropertyListingCard: Vertical thumbnail strip with left/right arrow navigation
  - PropertyDetailPage: Large main image with arrow navigation and thumbnail highlighting

## December 21, 2025 - Maintenance Ticket Contractor & Property Manager Display
- **Enhanced maintenance tickets** to show assigned contractor and property manager information:
  - Ticket cards now display contractor company name and property manager name
  - Details dialog shows full contractor info (company, contact name, phone, email)
  - Details dialog shows property manager info (name, phone, email)
- **Extended schema** with `assignedContractorId` on maintenance_tickets and `propertyManagerId` on properties tables
- **Added contractor storage methods** (getContractor, getAllContractors) to IStorage interface and DatabaseStorage
- **Enriched API response** at GET /api/crm/maintenance/tickets with `assignedContractor` and `propertyManager` nested objects
- **Added data-testid attributes** for test automation on contractor and property manager display elements

## December 21, 2025 - Comprehensive Managed Properties List View & Sample Data
- **Implemented comprehensive managed properties list view** in Property Management:
  - New table view showing: Property Address, Landlord (clickable), Tenant (clickable), Checklist progress, Management Fee, Management Period, Rent, Deposit, Actions
  - Landlord dialog with contact details (name, email, mobile, company) and quick action buttons
  - Tenant dialog with tenancy information (move-in/out dates, status)
  - Property Details dialog with full management information including 17-document checklist
- **Added new CRM API endpoints**:
  - GET /api/crm/landlords - List all landlords
  - GET /api/crm/tenants - List all tenants  
  - GET /api/crm/rental-agreements - List all rental agreements
  - GET /api/crm/managed-properties - Comprehensive list combining property, landlord, tenant, and agreement data
- **Added tenant storage methods** to server/storage.ts (getAllTenants, getTenant, createTenant, etc.)
- **Added data-testid attributes** to all managed property display elements for test automation
- **Protected checklist progress calculation** against division by zero
- **Extended database schema**:
  - Added landlords table columns: phone, address_line1, address_line2, city, postcode, company_name, company_address_line1, company_address_line2, company_city, company_postcode, notes, bank_name, account_holder_name
  - Added rental_agreements table columns: tenant_id, rent_start_date, rent_end_date, management_period, standing_order_setup, management_start_date, management_end_date, deposit_protection_ref, standing_order_ref, management_fee_fixed
- **Populated sample data**:
  - 5 landlords (James Worthington, Sarah Henderson-Clarke, Michael Chen Holdings Ltd, Victoria Pemberton, Robert & Jane Morrison)
  - 8 managed properties across West London (Notting Hill, Chelsea, Holland Park, Paddington Basin, Maida Vale, Bayswater, St Johns Wood, Chiswick)
  - 8 tenant users with full profiles
  - 8 rental agreements with complete management details
- **Switched to Replit database** (USE_SUPABASE=false) for development with extended schema

## December 19, 2025 - Section Scroll Order Swap
- **Swapped Properties and History sections** in the scroll animation order:
  - Properties section now appears second (after Hero) at scrollProgress 1.2-4.2
  - History section now appears third at scrollProgress 4.2-7.2
  - Updated z-index values: Properties z:20, History z:30
  - Logo placeholder animation remains at transition point (4.0-5.5)
  - Team section adjusted to start at 7.2 (after history)
  - GSAP animations updated with new scroll progress thresholds

## November 18, 2025 - Complete Implementation Audit & Status Report
- **Created IMPLEMENTATION_AUDIT.md** - 700+ line comprehensive audit document comparing built vs planned features
- **Audit Results:**
  - Overall completion: 65% of Phase 1-2 features
  - Fully implemented: 45% (User Management, Tenant Portal, Maintenance System)
  - Partially implemented: 20% (Property Management, Workflows, Voice Agent, Communication Hub)
  - Not started: 35% (Syndication, Analytics)
- **Key Findings:**
  - ✅ User Management System: COMPLETE (1017 line admin panel)
  - ✅ Property Maintenance: COMPLETE & IMPRESSIVE (AI triage, contractor matching, certification tracking)
  - ✅ Tenant Portal: COMPLETE (full ticket system)
  - 🔨 AI Voice Agent: Framework ready, needs API integration
  - 🔴 Multi-Platform Syndication: Schema only, not implemented
  - 🔴 Analytics Dashboard: Not started
- **Created comprehensive PRD Section 11** covering enhanced system requirements
- **Documented all 21 database tables** currently implemented
- **Provided implementation prompts** for each missing feature
- **Prioritized next steps:** Voice Agent → Syndication → Communication Hub → Analytics
- **Updated memory.md** with accurate feature status tracking
- **Estimated time to production:** 4-6 weeks with focused development

## November 18, 2025 - Property Feature Filtering System
- **Implemented comprehensive property feature filtering** for house properties:
  - Added propertyFeatures interface with 6 boolean fields: detached, semiDetached, frontGarden, backGarden, driveway, garage
  - Created collapsible feature filter panel in PropertySearchResults with checkbox controls
  - Implemented strict AND filtering logic requiring all selected features to match
  - Added "Clear All Filters" button for easy reset
  - Responsive grid layout: 2 columns mobile, 3 tablet, 6 desktop
- **Populated propertyFeatures data** for all 16 house-type properties (13 sales, 3 rentals, 1 commercial) with realistic feature combinations
- **Updated PropertyListing interface** to include propertyFeatures field
- **Enhanced PropertySearchResults** to integrate feature filtering alongside existing type, sort, and price filters
- **Tested and verified** feature filtering works correctly with strict AND logic and UI interactions (architect-approved)

## November 18, 2025 - Property Listing Card Enhancement
- **Updated PropertyListingCard component** to match Rightmove-style layout with:
  - Key features section with bullet points
  - Floor plan thumbnail indicator
  - EPC rating display with colored badge
  - Image gallery thumbnails (up to 4 visible)
  - Structured property stats grid (bedrooms, bathrooms, property type, tenure)
- **Integrated PropertySearchResults** into Sales and Rentals pages replacing inline property grids
- **Added keyFeatures field** to PropertyListing interface for displaying property highlights
- **Enhanced data conversion** in propertyListingsService to include keyFeatures, floorPlan, and epcRating fields
- **Fixed TypeScript errors** in PropertySearchResults component using Array.from for Set conversions
- **Removed obsolete GSAP animations** targeting non-existent elements after component restructure
- **Fixed duplicate "pcm" display** in rental property prices

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite for build tooling
- **UI Library**: Radix UI components with Tailwind CSS for styling
- **State Management**: TanStack Query for server state and forms with React Hook Form
- **Routing**: Wouter for client-side routing
- **Authentication**: Context-based authentication with protected routes
- **Design System**: Custom theme with Inter and Roboto fonts, consistent color scheme using CSS variables

## Backend Architecture
- **Framework**: Express.js with TypeScript for API endpoints
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Authentication**: Passport.js with local strategy and session-based auth
- **Session Storage**: PostgreSQL session store with connect-pg-simple
- **API Design**: RESTful endpoints with comprehensive error handling and request logging

## Data Storage Solutions
- **Primary Database**: PostgreSQL with Neon Database serverless hosting
- **Schema Management**: Drizzle migrations with schema definitions
- **Core Tables**: Users, properties, contacts, valuations, ownerships, chat messages
- **Relationships**: Foreign key relationships between users and their property interactions

## Authentication and Authorization
- **Strategy**: Session-based authentication using Passport.js local strategy
- **Password Security**: Scrypt-based password hashing with salt
- **Session Management**: Express sessions stored in PostgreSQL
- **Route Protection**: Middleware-based authentication checks for protected endpoints

## External Dependencies

### Property Data Services
- **Postcodes.io API**: Free UK postcode validation and address lookup
- **UK Land Registry**: Property price data integration for market valuations
- **OpenAI GPT-4**: AI-powered address generation and chat functionality

### Communication Services
- **Twilio**: SMS and WhatsApp Business API integration for customer notifications
- **SMTP Email**: Nodemailer with configurable SMTP providers for email delivery
- **SendGrid**: Secondary email service integration for reliable delivery

### Infrastructure Services
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **Replit Hosting**: Development and deployment platform integration
- **Vite Development**: Hot module replacement and optimized build pipeline

### Business Logic Integrations
- **Property Valuation**: Automated market value estimation using multiple data sources
- **Offer Calculation**: Algorithmic pricing based on property type, condition, and market data
- **Multi-channel Notifications**: Coordinated messaging across email, SMS, and WhatsApp platforms