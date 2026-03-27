# John Barclay Estate & Management Platform
## Product Requirements Document (PRD)

**Version:** 1.0  
**Last Updated:** November 18, 2025  
**Platform Type:** Full-Stack Real Estate Management Platform  
**Technology Stack:** React, TypeScript, Express, PostgreSQL, OpenAI, GSAP

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Public Website](#public-website)
3. [Property Portal & Listings](#property-portal--listings)
4. [CRM & Agent Dashboard](#crm--agent-dashboard)
5. [Rent & Property Management](#rent--property-management)
6. [Social Media Integration](#social-media-integration)
7. [AI Features](#ai-features)
8. [Technical Architecture](#technical-architecture)
9. [User Roles & Permissions](#user-roles--permissions)
10. [Integration Points](#integration-points)

---

## Executive Summary

John Barclay Estate & Management is a comprehensive real estate platform serving West London's premium property market. The platform combines a luxury public-facing website with a powerful CRM system, AI-powered features, and complete property lifecycle management.

### Key Value Propositions
- **For Clients:** Premium property search with AI-powered natural language queries, area guides, and instant valuations
- **For Agents:** Complete CRM with workflow automation, lead scoring, and multi-portal publishing
- **For Landlords:** Automated rent management, maintenance tracking, and tenant communication
- **For Tenants:** Self-service portal for maintenance requests, rent payments, and document access

---

## Public Website

### 1.1 Home Page (Scroll-Based Experience)

#### Hero Section
- **Design:** High-impact GSAP scroll-based animations with curtain roll system
- **Content:** 
  - Main logo with animated introduction
  - Tagline: "Over three decades of trusted property expertise across west and north west London"
  - Coverage area carousel (14 London postcodes)
- **Features:**
  - Smooth scroll with Lenis
  - Custom navigation with progress indicators
  - Social media links (Facebook, Instagram, Twitter)
  - Mobile-responsive design

#### History Section
- **Design:** Horizontal scrolling panels system
- **Content:**
  - 7 panels with company heritage story
  - Panel 1-5: Historical narrative
  - Panel 6: Mission statement (purple background)
  - Panel 7: Company statistics (35+ years, 1000+ properties, 24/7 support)
- **Animation:** Horizontal scroll triggered by vertical scrolling
- **Scroll Range:** 1.2 - 4.2 (3 scroll units)

#### Logo Transition Animation
- **Timing:** After history section completion (scroll 4.0-5.5)
- **Design:** Left-to-right reveal drawing effect in purple
- **Purpose:** Smooth transition between history and properties sections

#### Properties Section
- **Design:** Three vertical panels animating from different directions
- **Panels:**
  - **Left (Sales):** Slides in from left, orange/gold accents
  - **Middle (Rentals):** Slides in from top, purple accents
  - **Right (Commercial):** Slides in from right, gold accents
- **Features:** 
  - CTA buttons to respective property pages
  - Background images
  - Hover effects
- **Scroll Range:** 4.2 - 5.7 (1.5 scroll units - FAST)

#### Team Section
- **Design:** Grid layout with team member cards
- **Content:** Team members with photos, names, roles
- **Animation:** Fade-in on scroll
- **Scroll Range:** 5.7 - 8.2 (2.5 scroll units)

#### Contact Section
- **Design:** Two-column layout
- **Content:**
  - Contact information (phone, email, address)
  - WhatsApp integration with pre-filled messages
  - Office hours
  - Map embed
- **Scroll Range:** 8.2 - 10.7 (2.5 scroll units)

**Total Page Height:** ~10.7 scroll units

---

### 1.2 Sales Page (`/sales`)

#### Features
- **Hero Section:** Purple branded header with navigation
- **Natural Language Search:** AI-powered property search
  - Example: "3 bedroom house in Maida Vale under £750k"
- **Advanced Search Bar:**
  - Postcode/town input
  - Property type dropdown
  - Min/max bedrooms
  - Price range slider
  - Search button
- **Property Grid:** Responsive grid of property cards
- **CTA Cards:** Featured property promotions

#### Property Card Components
- Property image with fallback
- Price (formatted per listing type)
- Address and postcode
- Bedroom/bathroom count
- Property type badge
- Listing type badge (FOR SALE/TO LET)

---

### 1.3 Rentals Page (`/rentals`)

#### Features
- Similar layout to Sales page with rental-specific styling
- **Color Scheme:** Purple/gold branding
- **Search Filters:**
  - Rental-specific price ranges
  - Furnished status
  - Available from date
  - Minimum tenancy
- **Register Rental CTA:** Link to landlord registration

---

### 1.4 Commercial Page (`/commercial`)

#### Features
- **Design:** Premium gold/black styling for business properties
- **Property Types:**
  - Offices
  - Retail spaces
  - Industrial units
  - Mixed-use buildings
- **Featured Properties Section:** 
  - Large featured cards
  - Square footage prominently displayed
  - Business-focused descriptions

---

### 1.5 Area Pages (14 London Locations)

**Coverage Areas:**
- Bayswater (W2)
- Harlesden (NW10)
- Kensal Green (NW10)
- Kensal Rise (NW10)
- Kilburn (NW6)
- Ladbroke Grove (W10)
- Maida Vale (W9)
- North Kensington (W10)
- Queen's Park (NW6)
- Westbourne Park (W2)
- Willesden (NW10)
- Paddington
- Notting Hill
- St. John's Wood

#### Each Area Page Includes:
- **Hero Section:** Area-specific hero image and tagline
- **Market Overview:**
  - Average property prices
  - Price growth statistics
  - Investment perspective
- **Lifestyle Information:**
  - Transport links (Tube, Overground, bus)
  - Schools and education
  - Parks and recreation
  - Restaurants and amenities
  - Safety ratings
- **Property Market Analysis:**
  - Positive aspects
  - Negative aspects
  - Future developments
- **Featured Properties:** Properties in that specific area
- **Related Areas:** Links to neighboring postcodes

---

### 1.6 Property Detail Page (`/property/:id`)

#### Features
- **Image Gallery:** Full-width carousel with thumbnails
- **Property Information:**
  - Price with qualifier (guide price, POA, etc.)
  - Full description (AI-enhanced)
  - Property specifications table
  - Energy rating chart
  - Council tax band
  - Tenure information
- **Features & Amenities:**
  - Bullet-point lists
  - Icons for key features
- **Floor Plan:** Downloadable PDF
- **Map:** Interactive map with property location
- **Enquiry Form:**
  - Name, email, phone
  - Message
  - Viewing request options
- **Similar Properties:** AI-suggested similar listings
- **Share Buttons:** Social media sharing

---

### 1.7 Valuation Page (`/valuation`)

#### Features
- **Instant Online Valuation Form:**
  - Postcode search
  - AI address suggestion (powered by OpenAI)
  - Property type
  - Bedrooms/bathrooms
  - Condition
  - Recent improvements
  - Preferred contact method
- **Valuation Results Page:**
  - Estimated price range
  - Market analysis for the area
  - Comparable properties
  - Book professional valuation CTA
- **AI-Powered Address Generation:** Real UK street-level addresses based on postcode

---

### 1.8 Register Rental Page (`/register-rental`)

#### Features
- **Landlord Onboarding Form:**
  - Property details
  - Ownership information
  - Rental expectations
  - Maintenance preferences
- **Service Offerings:**
  - Full property management
  - Tenant finding only
  - Rent collection
  - Maintenance coordination

---

## Property Portal & Listings

### 2.1 Property Database

#### Property Schema
```typescript
{
  id: number
  listingType: 'sale' | 'rental'
  status: 'active' | 'under_offer' | 'sold' | 'let' | 'withdrawn'
  title: string
  description: string (AI-enhanced)
  price: number (in pence)
  priceQualifier: string
  propertyType: 'flat' | 'house' | 'maisonette' | 'penthouse' | 'studio'
  bedrooms: number
  bathrooms: number
  receptions: number
  squareFootage: number
  addressLine1: string
  addressLine2: string
  postcode: string
  areaId: number (links to London areas)
  tenure: 'freehold' | 'leasehold' | 'share_of_freehold'
  councilTaxBand: string
  energyRating: string (A-G)
  yearBuilt: number
  features: string[] (garden, parking, etc.)
  amenities: string[]
  images: string[]
  floorPlan: string
  furnished: 'furnished' | 'unfurnished' | 'part_furnished'
  availableFrom: date
  minimumTenancy: number (months)
  deposit: number
  createdAt: date
  updatedAt: date
}
```

---

### 2.2 Multi-Portal Syndication

#### Supported Portals
- **Rightmove** - UK's largest property portal
- **Zoopla** - Major UK property site
- **OnTheMarket** - Agent-owned portal
- **PropertyFinder** - International properties
- **PrimeLocation** - Premium properties
- **Facebook Marketplace** - Social selling
- **Instagram** - Visual marketing

#### Portal Listing Schema
```typescript
{
  id: number
  propertyId: number
  portalName: string
  portalAccountId: string
  portalListingId: string
  status: 'pending' | 'active' | 'paused' | 'removed' | 'error'
  lastSyncStatus: 'success' | 'failed' | 'partial'
  lastSyncMessage: string
  lastSyncAt: date
  publishedAt: date
  expiresAt: date
  viewsCount: number
  inquiriesCount: number
}
```

#### Features
- **One-Click Publishing:** Publish to multiple portals simultaneously
- **Sync Status Tracking:** Real-time status for each portal
- **Analytics:**
  - Views per portal
  - Inquiries generated
  - Best performing portals
- **Bulk Operations:** Pause/activate multiple listings
- **Error Handling:** Detailed error messages with retry options

---

### 2.3 Property Search & Filtering

#### Standard Filters
- **Listing Type:** Sale / Rental
- **Property Type:** Flat, House, Penthouse, Maisonette, Studio
- **Price Range:** Min/Max with sliders
- **Bedrooms:** Dropdown (Studio, 1, 2, 3, 4, 5+)
- **Bathrooms:** Dropdown
- **Location:** Postcode or area name
- **Radius Search:** Distance from postcode
- **Additional Filters:**
  - Tenure
  - Parking
  - Garden
  - Recently reduced
  - New to market

#### AI Natural Language Search
- **Examples:**
  - "3 bed house with garden in Maida Vale under £900k"
  - "Studio flat near Paddington station max £350 per week"
  - "Commercial property in Notting Hill for sale"
- **Powered by OpenAI GPT-4**
- **Extraction:**
  - Property type
  - Bedroom count
  - Price range
  - Location
  - Special features
- **Fallback:** Returns to standard filters if AI fails

---

### 2.4 Property Creation & Management

#### Property Creation Flow
1. **AI-Powered Property Parser:**
   - Input: Natural language description
   - Output: Structured property data
   - Endpoint: `POST /api/crm/properties/parse`
   
2. **Form Fields:**
   - Basic Info: Title (AI-generated if empty), Description (AI-enhanced)
   - Address: Auto-complete with UK postcode lookup
   - Details: Beds, baths, type, tenure
   - Pricing: Price, qualifier, deposit (rentals)
   - Features: Multi-select checkboxes
   - Images: Multi-upload with drag-and-drop
   - Floor Plans: PDF upload

3. **AI Enhancements:**
   - **Description Generator:** Creates compelling, SEO-optimized descriptions
   - **Title Generator:** Suggests catchy property titles
   - **Feature Suggester:** Recommends relevant features based on property type
   - **Area Matching:** Auto-assigns area based on postcode

#### Property Editing
- **Inline Editing:** Quick edit mode for price/status changes
- **Full Editor:** Complete property editor with all fields
- **Bulk Actions:**
  - Update status (multiple properties)
  - Republish to portals
  - Delete listings

---

## CRM & Agent Dashboard

### 3.1 Dashboard Overview (`/crm/dashboard`)

#### Metrics & KPIs
- **Today's Activity:**
  - New leads
  - Scheduled viewings
  - Offers received
  - Completions
- **Pipeline Overview:**
  - Properties by status
  - Active viewings
  - Pending offers
  - Under offer
  - Completed sales/lettings
- **Revenue Tracking:**
  - Month-to-date revenue
  - Commission earned
  - Target vs actual
- **Performance Charts:**
  - Properties sold/let per month
  - Average days on market
  - Conversion rates

#### Quick Actions
- Add new property
- Schedule viewing
- Create new lead
- Send bulk email
- Publish to portals

---

### 3.2 Workflow Management (`/crm/workflows`)

#### Property Workflow Stages

**Sales Workflow:**
1. **Valuation Requested**
   - Lead captured
   - Viewing scheduled
   - Valuation appointment
   
2. **Instruction**
   - Vendor agreement signed
   - Property photos scheduled
   - Marketing package prepared
   
3. **Listed**
   - Live on website
   - Published to portals
   - Marketing active
   
4. **Viewing Stage**
   - Viewings scheduled
   - Feedback collected
   - Follow-ups automated
   
5. **Offer Received**
   - Offer details logged
   - Vendor negotiation
   - Counter-offers tracked
   
6. **Offer Accepted**
   - Solicitor instructed
   - Mortgage application
   - Survey booked
   
7. **Exchange of Contracts**
   - Completion date set
   - Final checks
   - Deposit received
   
8. **Completion**
   - Keys handed over
   - Commission invoiced
   - Archive workflow

**Lettings Workflow:**
1. **Landlord Instruction**
2. **Property Listed**
3. **Tenant Application**
4. **Referencing**
5. **Tenancy Agreement**
6. **Move-In**
7. **Active Tenancy**
8. **Renewal/Exit**

#### Features
- **Kanban Board View:** Drag-and-drop between stages
- **Timeline View:** Chronological property journey
- **Task Automation:**
  - Auto-create tasks per stage
  - Email reminders
  - Document generation
- **Document Management:**
  - Contracts
  - EPCs
  - Gas certificates
  - Inventory reports

---

### 3.3 Lead & Enquiry Management

#### Enquiry Capture
- **Sources Tracked:**
  - Website contact form
  - Property enquiry
  - Portal inquiry (Rightmove, Zoopla)
  - Phone call
  - Walk-in
  - Email
  - Social media

#### Enquiry Schema
```typescript
{
  id: number
  propertyId: number
  source: 'website' | 'phone' | 'email' | 'portal' | 'walk_in'
  sourceDetails: string
  enquiryType: 'viewing' | 'valuation' | 'general' | 'offer'
  customerName: string
  customerEmail: string
  customerPhone: string
  message: string
  priority: 'hot' | 'warm' | 'cold'
  aiLeadScore: number (1-10)
  aiLeadReason: string
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost'
  assignedTo: number (agent ID)
  followUpDate: date
  notes: string
  createdAt: date
}
```

#### AI Lead Scoring
- **Powered by OpenAI**
- **Scoring Factors:**
  - Message quality and detail
  - Urgency indicators
  - Budget alignment
  - Timeline readiness
  - Contact completeness
- **Output:**
  - Lead score (1-10)
  - Priority classification
  - Suggested response
  - Next action recommendation

#### Lead Nurturing
- **Automated Follow-ups:**
  - Day 1: Welcome email
  - Day 3: Similar properties suggestion
  - Day 7: Market update
  - Day 14: Check-in call
- **Email Templates:** Pre-designed for common scenarios
- **SMS Notifications:** Viewing reminders, new properties
- **WhatsApp Integration:** Business account messaging

---

### 3.4 Viewing Management

#### Viewing Scheduler
- **Features:**
  - Calendar view (day/week/month)
  - Agent availability
  - Property availability
  - Conflict detection
- **Viewing Types:**
  - In-person viewing
  - Virtual viewing (video call)
  - Block viewing (multiple clients)

#### Viewing Schema
```typescript
{
  id: number
  propertyId: number
  viewerId: number
  viewerName: string
  viewerEmail: string
  viewerPhone: string
  scheduledDate: datetime
  duration: number (minutes)
  agentId: number
  viewingType: 'in_person' | 'virtual' | 'open_house'
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
  feedback: string
  interestLevel: 'very_interested' | 'interested' | 'not_interested'
  nextSteps: string
  createdAt: date
}
```

#### Notifications
- **Email Confirmations:** Sent to viewer and agent
- **SMS Reminders:** 24 hours and 1 hour before
- **WhatsApp Messages:** Viewing details and directions
- **Calendar Invites:** iCal attachments

---

### 3.5 Offer Management

#### Offer Tracking
```typescript
{
  id: number
  propertyId: number
  buyerId: number
  buyerName: string
  buyerEmail: string
  offerAmount: number
  offerDate: date
  validUntil: date
  conditions: string[]
  financingType: 'cash' | 'mortgage' | 'chain'
  chainPosition: number
  solicitorDetails: string
  mortgageInPrinciple: boolean
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'countered'
  counterOfferAmount: number
  vendorResponse: string
  acceptedDate: date
  notes: string
}
```

#### Features
- **Offer Comparison:** Side-by-side offer comparison
- **Chain Visualization:** Buyer/seller chain diagram
- **Negotiation History:** Full negotiation log
- **Vendor Communication:** Email/SMS vendor updates
- **Auto-notifications:** Instant alerts on new offers

---

### 3.6 User & Staff Management (`/crm/users`)

#### User Roles
1. **Admin** - Full system access
2. **Agent** - CRM access, property management
3. **Landlord** - Property owner portal
4. **Tenant** - Tenant portal access
5. **Maintenance Staff** - Maintenance tickets only
6. **User** - Basic account (website saved searches)

#### User Management Features
- **User CRUD:** Create, read, update, delete users
- **Role Assignment:** Change user roles
- **Status Management:** Active/inactive users
- **Password Reset:** Forced password changes
- **Audit Logs:** Track admin actions

#### Staff Profiles
```typescript
{
  userId: number
  employeeId: string
  jobTitle: string
  department: 'sales' | 'lettings' | 'maintenance' | 'admin' | 'management'
  employmentType: 'full_time' | 'part_time' | 'contractor'
  startDate: date
  baseSalary: number
  commissionRate: decimal
  targetMonthly: number
  skills: string[]
  certifications: object[]
  languages: string[]
  performanceRating: decimal
  isActive: boolean
}
```

#### Attendance Tracking
- Clock in/out times
- Break tracking
- Overtime calculation
- Leave management
- Remote work logging

---

### 3.7 Voice Agent Dashboard (`/crm/voice-agent`)

#### AI Voice Agent "Sarah"
- **Powered by:** OpenAI Real-time API
- **Capabilities:**
  - Answer property inquiries
  - Book viewings
  - Schedule valuations
  - Qualify leads
  - Transfer to human agent
- **Features:**
  - Call recording
  - Transcription
  - Sentiment analysis
  - Lead scoring
  - Auto-CRM updates

#### Call Logs
```typescript
{
  id: number
  callerId: string
  startTime: datetime
  endTime: datetime
  duration: number
  transcript: string
  intent: 'viewing' | 'valuation' | 'general' | 'complaint'
  outcome: 'booked' | 'transferred' | 'information' | 'no_answer'
  leadCreated: boolean
  recordingUrl: string
  sentimentScore: decimal
}
```

---

## Rent & Property Management

### 4.1 Tenancy Management

#### Tenancy Schema
```typescript
{
  id: number
  propertyId: number
  landlordId: number
  tenantId: number
  startDate: date
  endDate: date
  rentAmount: number (monthly)
  depositAmount: number
  depositScheme: string
  rentDueDay: number (day of month)
  paymentMethod: 'standing_order' | 'direct_debit' | 'bank_transfer'
  status: 'active' | 'notice_given' | 'expired' | 'renewed'
  renewalDate: date
  documents: string[]
  createdAt: date
}
```

#### Features
- **Tenancy Timeline:** Visual tenancy lifecycle
- **Automatic Renewals:** Renewal reminders and workflows
- **Rent Review:** Rent increase management
- **Notice Period Tracking:** Countdown to tenancy end
- **Document Storage:**
  - Tenancy agreement
  - Inventory
  - Check-in report
  - Deposit certificates

---

### 4.2 Rent Collection

#### Payment Tracking
```typescript
{
  id: number
  tenancyId: number
  dueDate: date
  amount: number
  paymentDate: date
  paymentMethod: string
  reference: string
  status: 'paid' | 'pending' | 'late' | 'partial' | 'missed'
  lateFeesApplied: number
  notes: string
}
```

#### Features
- **Payment Schedule:** Full rent payment calendar
- **Auto-Payment Matching:** Bank feed integration
- **Late Payment Alerts:**
  - Day 1: Automated reminder email
  - Day 3: SMS notification
  - Day 7: Escalation to landlord
  - Day 14: Legal notice preparation
- **Arrears Management:** 
  - Payment plan creation
  - Negotiation tracking
  - Legal action workflow

#### Landlord Portal
- **Rent Statement:** Monthly/annual statements
- **Payment History:** Full payment log
- **Tax Documents:** Annual tax summary
- **Direct Payments:** View incoming rents

---

### 4.3 Maintenance Management

#### Maintenance Ticket System

**Ticket Schema:**
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
  aiCategorization: string
  aiUrgencyScore: number (1-10)
  aiSuggestedAssignee: number
  aiRoutingReason: string
  status: 'new' | 'assigned' | 'in_progress' | 'awaiting_parts' | 'completed' | 'closed'
  assignedToId: number
  images: string[]
  estimatedCost: number
  actualCost: number
  paidBy: 'landlord' | 'tenant' | 'agency'
  resolutionNotes: string
  createdAt: date
  resolvedAt: date
}
```

#### AI Maintenance Assessment
- **Powered by OpenAI**
- **Automatic:**
  - Category detection
  - Urgency scoring (1-10)
  - Contractor suggestion
  - Cost estimation
  - Routing to appropriate staff
- **Learning:** Improves with historical data

#### Contractor Management
```typescript
{
  id: number
  name: string
  companyName: string
  email: string
  phone: string
  specializations: string[]
  serviceAreas: string[]
  hourlyRate: number
  fixedRates: object
  rating: decimal
  completedJobs: number
  averageResponseTime: number (hours)
  insuranceExpiry: date
  certifications: object[]
  isActive: boolean
}
```

#### Work Order Flow
1. **Ticket Created:** Tenant submits via portal
2. **AI Assessment:** Auto-categorization and urgency
3. **Assignment:** Auto-assign to contractor or staff
4. **Notification:** SMS/Email to contractor
5. **Acceptance:** Contractor confirms availability
6. **In Progress:** Status updates from contractor
7. **Completion:** Photos, notes, cost details
8. **Tenant Confirmation:** Tenant approves work
9. **Invoice:** Auto-generate invoice
10. **Payment:** Mark as paid and close

#### Tenant Portal - Maintenance
- **Submit Ticket:** Photo upload, description
- **Track Status:** Real-time updates
- **Chat:** Message with contractor/agent
- **History:** All past tickets
- **Feedback:** Rate completed work

---

### 4.4 Property Inspections

#### Inspection Types
- **Check-In Inspection:** Move-in condition
- **Mid-Term Inspection:** Routine 6-month checks
- **Check-Out Inspection:** Move-out assessment
- **Compliance Inspection:** Safety certificate renewals

#### Inspection Schema
```typescript
{
  id: number
  propertyId: number
  inspectionType: string
  scheduledDate: date
  inspector: number (staff ID)
  status: 'scheduled' | 'completed' | 'cancelled'
  findings: object[]
  photos: string[]
  actionItems: string[]
  passedInspection: boolean
  reportPDF: string
  signatureUrl: string
  createdAt: date
}
```

#### Features
- **Digital Forms:** Mobile-friendly checklists
- **Photo Evidence:** Attach unlimited photos
- **E-Signatures:** Tenant/landlord signatures
- **PDF Report Generation:** Auto-generated reports
- **Action Item Creation:** Auto-create maintenance tickets

---

### 4.5 Compliance & Certifications

#### Certificate Tracking
```typescript
{
  id: number
  propertyId: number
  certificateType: 'gas_safety' | 'epc' | 'eicr' | 'legionella' | 'fire_safety' | 'pat'
  issueDate: date
  expiryDate: date
  certificateNumber: string
  issuedBy: string
  documentUrl: string
  status: 'valid' | 'expiring_soon' | 'expired'
  reminderSent: boolean
}
```

#### Certificate Types & Renewal Periods
- **Gas Safety Certificate:** Annual
- **EPC (Energy Performance Certificate):** 10 years
- **EICR (Electrical Installation Condition Report):** 5 years
- **Legionella Risk Assessment:** 2 years
- **Fire Safety Certificate:** Annual
- **PAT Testing:** Annual (for furnished properties)

#### Automated Reminders
- **90 days before expiry:** First reminder to landlord
- **60 days before expiry:** Second reminder + book contractor
- **30 days before expiry:** Urgent alert
- **Expiry date:** Critical alert + compliance warning
- **Post-expiry:** Daily alerts until renewed

---

### 4.6 Landlord Portal

#### Dashboard
- **Portfolio Overview:** All properties at a glance
- **Financial Summary:**
  - Total rent collected (month/year)
  - Outstanding rent
  - Maintenance costs
  - Net profit
- **Property Performance:**
  - Void periods
  - Rental yield
  - Occupancy rate
- **Alerts:**
  - Rent arrears
  - Expiring certificates
  - Pending maintenance
  - Tenancy renewals

#### Features
- **Document Vault:** Secure document storage
- **Income Reports:** Detailed financial reports
- **Maintenance Approval:** Approve/reject maintenance requests over threshold
- **Tenant Communication:** Secure messaging
- **Instruction Management:** Service level selection

---

## Social Media Integration

### 5.1 Social Media Post Management

#### Supported Platforms
- Facebook (Pages & Marketplace)
- Instagram (Feed & Stories)
- Twitter/X
- LinkedIn
- TikTok (Property tours)
- YouTube (Property videos)

#### Social Media Post Schema
```typescript
{
  id: number
  propertyId: number
  platform: 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'tiktok'
  accountId: number
  postType: 'listing' | 'open_house' | 'sold' | 'market_update' | 'testimonial'
  content: string
  hashtags: string[]
  media: string[]
  scheduledFor: datetime
  publishedAt: datetime
  status: 'draft' | 'scheduled' | 'published' | 'failed'
  postUrl: string
  engagement: object {
    likes: number
    comments: number
    shares: number
    reach: number
    clicks: number
  }
  createdAt: date
}
```

#### Social Media Account Schema
```typescript
{
  id: number
  platform: string
  accountName: string
  accountHandle: string
  accessToken: string (encrypted)
  refreshToken: string (encrypted)
  tokenExpiry: date
  isActive: boolean
  autoPost: boolean
  defaultHashtags: string[]
  postingSchedule: object
}
```

---

### 5.2 Auto-Posting Features

#### Property Listing Auto-Post
- **Trigger:** New property published
- **Platforms:** All configured accounts
- **Content Generation:**
  - AI-generated social media copy
  - Optimized for each platform
  - Platform-specific hashtags
  - Best posting times
- **Media:**
  - Primary property image
  - Carousel for multiple images
  - Video tours
  - Virtual tour links

#### Post Templates
**New Listing Template:**
```
🏡 JUST LISTED! 

{property_title}
{bedrooms} bed {property_type} in {area}

✨ {key_features}
💰 £{price} {listing_type}

🔗 View full details: {property_url}

{hashtags}
```

**Price Reduction Template:**
```
🔥 PRICE REDUCED! 

Save £{reduction_amount} on this beautiful {property_type}

Was: £{old_price}
Now: £{new_price}

Don't miss out! {property_url}

{hashtags}
```

**Sold/Let Template:**
```
✅ JUST {sold_or_let}! 

Another happy client finding their perfect home 🏠

Looking for similar properties? 
📞 {phone}
💌 {email}

{hashtags}
```

---

### 5.3 Content Calendar

#### Features
- **Visual Calendar:** Month/week/day views
- **Drag & Drop Scheduling:** Easy rescheduling
- **Bulk Scheduling:** Schedule multiple posts
- **Content Types:**
  - Property listings
  - Market updates
  - Client testimonials
  - Area spotlights
  - Team introductions
  - Tips & advice
  - Virtual tours
- **Analytics Dashboard:**
  - Best performing posts
  - Engagement rates
  - Follower growth
  - Click-through rates
  - Lead generation tracking

---

### 5.4 Social Media Analytics

#### Tracked Metrics
- **Engagement:**
  - Likes, comments, shares
  - Engagement rate
  - Best performing content
- **Reach:**
  - Impressions
  - Unique viewers
  - Viral coefficient
- **Conversions:**
  - Website clicks
  - Enquiries generated
  - Viewings booked
  - Properties sold/let from social
- **Audience:**
  - Follower growth
  - Demographics
  - Active times
  - Geographic distribution

#### Reporting
- **Weekly Summary:** Email report every Monday
- **Monthly Deep Dive:** Comprehensive monthly analytics
- **Property Performance:** Social media impact per property
- **ROI Tracking:** Cost per lead, cost per conversion

---

### 5.5 WhatsApp Business Integration

#### Features
- **Pre-filled Messages:** One-click WhatsApp buttons
- **Message Templates:**
  - General inquiry
  - Viewing request
  - Valuation request
  - Maintenance issue
  - Rent payment query
- **Business Account:**
  - Verified business badge
  - Catalog integration
  - Quick replies
  - Away messages
- **Automation:**
  - Auto-responses for common queries
  - Property details on request
  - Viewing availability
  - Instant brochure sharing

#### WhatsApp CTAs on Website
- Hero section: "Chat with us on WhatsApp"
- Property pages: "Enquire via WhatsApp"
- Contact section: Pre-filled service messages
- Maintenance portal: "Report issue via WhatsApp"

---

## AI Features

### 6.1 AI-Powered Property Search

#### Natural Language Query Processing
- **Model:** OpenAI GPT-4
- **Endpoint:** `POST /api/search/natural-language`
- **Input:** Free-text search query
- **Output:** Structured search criteria

**Example Queries:**
```
"Looking for a 2 bed flat in Queen's Park under £450k with a garden"
→ {
  propertyType: "flat",
  bedrooms: 2,
  location: "Queen's Park",
  maxPrice: 450000,
  features: ["garden"]
}

"Need an office space in Maida Vale around 1000 square feet"
→ {
  propertyType: "commercial",
  location: "Maida Vale",
  squareFootage: 1000
}
```

---

### 6.2 AI Content Generation

#### Property Description Enhancement
- **Endpoint:** `POST /api/ai/enhance-description`
- **Input:** Basic property details
- **Output:** Compelling, SEO-optimized description
- **Features:**
  - Highlights unique selling points
  - Includes area benefits
  - Optimized for search engines
  - Professional tone
  - 150-300 words

#### Property Title Generation
- **Endpoint:** `POST /api/ai/generate-title`
- **Examples:**
  - "Stunning Victorian Terrace in Prime Maida Vale Location"
  - "Luxurious 2-Bed Penthouse with Panoramic London Views"
  - "Charming Studio Apartment Near Paddington Station"

#### Feature Suggestions
- **Input:** Property type, bedrooms, area
- **Output:** Relevant feature list
- **Logic:** Based on common features for similar properties

---

### 6.3 AI Lead Scoring

#### Lead Assessment
- **Model:** GPT-4
- **Input:** Enquiry message, contact details, property interest
- **Output:**
  ```typescript
  {
    score: number (1-10)
    priority: 'hot' | 'warm' | 'cold'
    reasoning: string
    suggestedResponse: string
    nextAction: string
    estimatedConversionProbability: decimal
  }
  ```

#### Scoring Factors
- **Message Quality:** Detail level, questions asked
- **Urgency:** Timeline indicators ("ASAP", "urgent", "this week")
- **Budget:** Price alignment with property
- **Contact Info:** Completeness (name, email, phone)
- **Property Fit:** Match between request and property
- **Behavioral Signals:** Multiple enquiries, saved properties

---

### 6.4 AI Maintenance Routing

#### Ticket Categorization
- **Endpoint:** `POST /api/ai/assess-maintenance`
- **Input:** Ticket description, images
- **Process:**
  1. Category detection (plumbing, electrical, etc.)
  2. Urgency scoring (1-10)
  3. Contractor matching
  4. Cost estimation
  5. SLA assignment

#### Example Output
```typescript
{
  category: "plumbing",
  urgency: 8,
  urgencyReason: "Water leak mentioned - potential property damage",
  suggestedContractor: 12,
  contractorReason: "Plumber with 4.8★ rating, average 2hr response time",
  estimatedCost: 15000, // £150
  slaHours: 4,
  escalationRequired: true
}
```

---

### 6.5 AI Voice Agent

#### Capabilities
- **Property Inquiries:** Answer questions about listings
- **Viewing Booking:** Schedule viewings
- **Valuation Booking:** Book valuation appointments
- **Lead Qualification:** Collect buyer/renter information
- **Information Lookup:** Property details, area info
- **Transfer to Human:** Seamless handoff when needed

#### Conversation Flow
1. **Greeting:** "Hello, I'm Sarah from John Barclay. How can I help you today?"
2. **Intent Detection:** Understand caller's need
3. **Information Gathering:** Collect relevant details
4. **Action:** Book viewing, send details, etc.
5. **Confirmation:** Summarize and confirm
6. **Next Steps:** Email confirmation, agent follow-up

#### Integration Points
- **CRM:** Auto-create leads and tasks
- **Calendar:** Real-time availability check
- **Email:** Automatic confirmation emails
- **SMS:** Booking confirmations
- **Call Recording:** All calls recorded and transcribed

---

### 6.6 UK Address Generation

#### Postcode-Based Address Lookup
- **Endpoint:** `POST /api/ai/generate-addresses`
- **Input:** UK postcode
- **Output:** 5 realistic UK addresses
- **Features:**
  - Real street names
  - Actual localities
  - Correct town/county
  - House numbers/names
  - Validation against UK postcode database

**Example:**
```typescript
Input: "W9 1AA"
Output: [
  {
    addressLine1: "12 Warwick Avenue",
    addressLine2: "Little Venice",
    town: "London",
    county: "Greater London",
    postcode: "W9 1AA"
  },
  // ... 4 more addresses
]
```

---

## Technical Architecture

### 7.1 Technology Stack

#### Frontend
- **Framework:** React 18 with TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS + shadcn/ui components
- **Animations:** GSAP (GreenSock), Framer Motion
- **Smooth Scroll:** Lenis
- **Forms:** React Hook Form + Zod validation
- **State Management:** TanStack Query (React Query)
- **Routing:** Wouter
- **Icons:** Lucide React, React Icons

#### Backend
- **Runtime:** Node.js
- **Framework:** Express.js
- **Language:** TypeScript
- **ORM:** Drizzle ORM
- **Database:** PostgreSQL (Neon/Supabase)
- **Authentication:** Passport.js (Local Strategy)
- **Session Management:** Express Session + PostgreSQL store
- **API Client:** OpenAI SDK

#### External Services
- **AI:** OpenAI GPT-4, Real-time API
- **Email:** SendGrid
- **SMS:** Twilio
- **Maps:** Google Maps API
- **Cloud Storage:** Supabase Storage
- **Hosting:** Replit
- **Database:** Supabase PostgreSQL

---

### 7.2 Database Schema Overview

#### Core Tables
- `users` - User accounts (all roles)
- `properties` - Property listings
- `london_areas` - Coverage areas
- `enquiries` - Customer inquiries
- `viewings` - Viewing appointments
- `offers` - Purchase offers
- `tenancies` - Rental agreements
- `rent_payments` - Rent payment tracking
- `maintenance_tickets` - Maintenance requests
- `maintenance_ticket_updates` - Ticket history
- `contractors` - Contractor database
- `work_orders` - Contractor assignments
- `property_inspections` - Inspection reports
- `certifications` - Compliance certificates
- `property_portal_listings` - Portal syndication
- `social_media_posts` - Social media content
- `social_media_accounts` - Platform connections
- `staff_profiles` - Employee data
- `staff_attendance` - Time tracking
- `staff_leave` - Leave management
- `workflows` - Sales/lettings workflows
- `workflow_stages` - Workflow stage definitions
- `documents` - Document storage
- `audit_logs` - System audit trail

---

### 7.3 API Architecture

#### Public API Endpoints
```
GET  /api/properties - List properties (with filters)
GET  /api/properties/:id - Property details
POST /api/search/natural-language - AI search
POST /api/properties/natural-search - AI property search
GET  /api/areas - London areas list
GET  /api/areas/:id - Area details
POST /api/enquiries - Submit enquiry
POST /api/valuations - Request valuation
POST /api/viewings - Book viewing
```

#### CRM API Endpoints (Protected)
```
GET    /api/crm/properties - List all properties
POST   /api/crm/properties - Create property
PUT    /api/crm/properties/:id - Update property
DELETE /api/crm/properties/:id - Delete property
POST   /api/crm/properties/parse - AI property parser
POST   /api/crm/properties/:id/publish - Publish to portals

GET    /api/crm/enquiries - List enquiries
PUT    /api/crm/enquiries/:id - Update enquiry

GET    /api/crm/workflows - Workflow list
POST   /api/crm/workflows - Create workflow
PUT    /api/crm/workflows/:id - Update workflow

GET    /api/crm/maintenance/tickets - Tickets list
POST   /api/crm/maintenance/tickets - Create ticket
PUT    /api/crm/maintenance/tickets/:id - Update ticket

GET    /api/crm/users - User management
POST   /api/crm/users - Create user
PUT    /api/crm/users/:id - Update user
```

---

### 7.4 Authentication & Authorization

#### User Roles & Permissions
| Feature | Admin | Agent | Landlord | Tenant | Maintenance | User |
|---------|-------|-------|----------|--------|-------------|------|
| View Properties | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Create Properties | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edit Properties | ✅ | ✅ | Own only | ❌ | ❌ | ❌ |
| Delete Properties | ✅ | Admin approval | ❌ | ❌ | ❌ | ❌ |
| View Enquiries | ✅ | ✅ | Own properties | ❌ | ❌ | Own only |
| Manage Workflows | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| View Maintenance | ✅ | ✅ | Own properties | Own only | Assigned | ❌ |
| Create Tickets | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Assign Contractors | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| View Financials | ✅ | ✅ | Own only | ❌ | ❌ | ❌ |
| Manage Users | ✅ | View only | ❌ | ❌ | ❌ | ❌ |
| Access Voice Agent | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Publish to Portals | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

#### Session Management
- **Storage:** PostgreSQL with connect-pg-simple
- **Duration:** 7 days
- **Security:**
  - HttpOnly cookies
  - Secure flag (HTTPS)
  - SameSite strict
  - CSRF protection

---

## User Roles & Permissions

### 9.1 Admin
**Full System Access**
- All CRM features
- User management
- System configuration
- Financial reports
- Audit logs
- Portal credentials
- API settings

### 9.2 Agent
**Property & Client Management**
- Property CRUD
- Enquiry management
- Workflow management
- Viewing scheduling
- Offer management
- Voice agent access
- Social media posting
- Limited user view

### 9.3 Landlord
**Portfolio Management**
- View own properties
- Financial statements
- Maintenance approval (>£500)
- Tenant communication
- Document access
- Certificate tracking
- Inspection reports

### 9.4 Tenant
**Tenancy Management**
- Submit maintenance tickets
- View rent history
- Download documents
- Message landlord/agent
- Book inspections
- Update contact details

### 9.5 Maintenance Staff
**Work Order Management**
- View assigned tickets
- Update ticket status
- Upload completion photos
- Submit invoices
- View property details
- Clock in/out

### 9.6 User
**Public Account**
- Save searches
- Favorite properties
- Email alerts
- Viewing requests
- Saved preferences

---

## Integration Points

### 10.1 Email Integration (SendGrid)
- **Transactional Emails:**
  - Welcome emails
  - Password resets
  - Booking confirmations
  - Enquiry acknowledgments
- **Marketing Emails:**
  - New property alerts
  - Market updates
  - Newsletter
- **Automated Emails:**
  - Viewing reminders
  - Rent due notices
  - Certificate expiry alerts

### 10.2 SMS Integration (Twilio)
- **Notifications:**
  - Viewing confirmations
  - Urgent maintenance
  - Rent reminders
  - Offer updates
- **Two-Factor Authentication**
- **Verification Codes**

### 10.3 WhatsApp Business
- **Customer Communication:**
  - Instant property details
  - Viewing scheduling
  - General inquiries
  - Maintenance updates
- **Automated Responses**
- **Rich Media:** Photos, videos, documents

### 10.4 Property Portals
- **Rightmove API**
- **Zoopla API**
- **OnTheMarket API**
- **Features:**
  - Automated listings sync
  - Lead capture
  - Analytics tracking

### 10.5 Social Media APIs
- **Facebook Graph API**
- **Instagram Basic Display API**
- **Twitter API v2**
- **LinkedIn API**
- **Auto-posting**
- **Engagement tracking**

### 10.6 OpenAI Integration
- **GPT-4:** Natural language processing
- **Realtime API:** Voice agent
- **Use Cases:**
  - Property search
  - Content generation
  - Lead scoring
  - Maintenance routing
  - Address generation

### 10.7 Google Maps API
- **Property mapping**
- **Area boundaries**
- **Nearby amenities**
- **Distance calculations**

---

## Enhanced System Requirements (Phase 2)

### 11.1 Multi-Role Authentication & Homepage Login System

#### 10 User Role Types

**Property Seekers (user)**
- Browse properties with saved searches
- Favourite/bookmark properties
- Contact agents for viewings
- Track viewing history
- Receive property alerts

**Property Landlords (landlord)**
- Access landlord portal
- View property portfolio
- Financial reports and rent statements
- Approve maintenance over threshold (£500+)
- Tenant communication

**Property Sellers (new role: property_seller)**
- Track property sale progress
- View viewing feedback
- Receive offer notifications
- Document access (EPCs, etc.)
- Communication with sales team

**Super Admin (super_admin)**
- Full system access
- User management (create/delete/modify all roles)
- System configuration
- Access all dashboards
- Audit logs and system monitoring
- API key management

**Estate Agency Owner (agency_owner)**
- Business owner dashboard
- View all sales and rental metrics
- Revenue analytics and commission tracking
- Staff performance metrics
- Portfolio overview
- Strategic reporting

**Sales Manager (sales_manager)**
- Access sales CRM
- Manage sales team
- Assign properties to sales staff
- Approve listings and pricing
- Sales pipeline management
- Performance tracking

**Sales Staff (sales_agent)**
- Sales CRM access
- Create/manage sale properties
- Handle enquiries and viewings
- Process offers
- Sales workflow management
- Customer relationship management

**Rental Manager (rental_manager)**
- Access rental CRM
- Manage rental team
- Approve new tenancies
- Rent review approvals
- Rental pipeline management
- Performance tracking

**Rental Staff (rental_agent)**
- Rental CRM access
- Create/manage rental properties
- Tenancy management
- Rent collection tracking
- Property inspections
- Tenant communication

**Property Tenants (tenant)**
- Tenant portal access
- Raise maintenance tickets
- Track ticket status
- View rent payment history
- Access tenancy documents
- Message landlord/agent

#### Homepage Login System

**Login Flow:**
1. User enters credentials on homepage
2. System authenticates and identifies role
3. Redirect to appropriate dashboard based on role:
   - **Property Seekers** → Public site with saved searches panel
   - **Super Admin** → Super admin dashboard (full system access)
   - **Agency Owner** → Business owner dashboard
   - **Sales Manager** → Sales management CRM
   - **Sales Staff** → Sales CRM
   - **Rental Manager** → Rental management CRM
   - **Rental Staff** → Rental CRM
   - **Landlord** → Landlord portal
   - **Tenant** → Tenant portal with ticket system
   - **Property Seller** → Seller dashboard

**Features:**
- Single sign-on across all portals
- Remember me functionality
- Password reset workflow
- Two-factor authentication (optional)
- Session timeout (7 days default)
- Role-based UI rendering

---

### 11.2 Property Management Wizard

#### Multi-Step Wizard for Adding Properties

**Step 1: Property Type & Details**
- Property type selector (House, Flat, Commercial, etc.)
- Listing type (Sale/Rental)
- Number of bedrooms, bathrooms
- Square footage
- Address input with postcode validation

**Step 2: Image Upload**
- Multiple image upload (drag & drop)
- Image reordering
- Set primary image
- Image optimization and compression
- Supported formats: JPG, PNG, WEBP
- Maximum 20 images per property

**Step 3: Floor Plan & Documents**
- Floor plan upload
- EPC (Energy Performance Certificate) upload
- Additional documents (surveys, etc.)
- Document preview and validation

**Step 4: Key Features**
- Checkboxes for common features:
  - Garden (front/back)
  - Parking/Driveway
  - Garage
  - Balcony/Terrace
  - Recently renovated
  - Period features
  - Modern kitchen
  - En-suite bathrooms
- Custom feature input field

**Step 5: AI Property Card Generation**
- System uses OpenAI GPT-4 to generate:
  - **Property Title:** Compelling SEO-optimized title
  - **Property Description:** 200-300 word description including:
    - Property highlights
    - Area knowledge from `londonAreas` table
    - Local amenities and transport
    - Investment perspective
    - Unique selling points
- User can edit AI-generated content
- Regenerate option if not satisfied

**Step 6: Pricing & Availability**
- Price input
- Available from date (rentals)
- Minimum tenancy (rentals)
- Deposit amount (rentals)
- Tenure (freehold/leasehold)
- Council tax band

**Step 7: QR Code Generation**
- System automatically generates QR code
- QR code links to property detail page URL
- Downloadable QR code image (PNG, SVG)
- Printable format for marketing materials
- QR code stored in database with property
- Use case: Print on property window cards, flyers

**Wizard Features:**
- Progress indicator
- Save as draft
- Back/Next navigation
- Field validation at each step
- Preview before publishing
- Publish to website immediately or schedule

---

### 11.3 Enhanced Maintenance Ticket Lifecycle System

#### Full Ticket Lifecycle

**1. Ticket Creation (Tenant Portal)**
- Tenant describes issue
- Upload images (up to 5)
- Select urgency (if known)
- Property auto-populated from tenant record

**2. AI Categorization & Routing**
```typescript
{
  aiCategorization: 'plumbing' | 'electrical' | 'heating' | 'appliance' | 'structural' | 'pest_control' | 'cleaning' | 'garden' | 'security' | 'other'
  aiUrgencyScore: 1-10 (emergency=9-10, urgent=6-8, routine=3-5, low=1-2)
  aiSuggestedContractors: number[] // IDs of suitable contractors
  aiRoutingReason: string // Explanation for contractor selection
  estimatedCostRange: { min: number, max: number } // In pence
}
```

**3. Contractor Identification**
- AI analyzes ticket description and images
- Matches against contractor database:
  - Specialties (plumbing, electrical, etc.)
  - Availability
  - Ratings and past performance
  - Geographic coverage
  - Certification status
- Suggests top 3 contractors

**4. Quote Request**
- System automatically notifies suggested contractors
- Email template includes:
  - Ticket description
  - Images
  - Property address
  - Urgency level
  - Deadline for quote submission
- Contractors can accept/decline job
- Contractors submit quotes through portal

**5. Quote Comparison & Approval**
- Rental Manager/Landlord views quotes
- Comparison table:
  - Price
  - Estimated completion time
  - Contractor rating
  - Past performance
- Approve/reject quotes
- Auto-approval for tickets under £200
- Landlord approval required for >£500

**6. Work Order Creation**
- Approved quote creates work order
- Contractor notified via email/SMS
- Calendar appointment created
- Tenant notified of scheduled date

**7. Work Progress Tracking**
- Contractor updates status:
  - Scheduled
  - In progress
  - Awaiting parts
  - Completed
  - Requires follow-up
- Photo evidence upload upon completion
- Time tracking for billing

**8. Completion & Sign-off**
- Tenant confirms work completed
- Rating and feedback
- Invoice submitted by contractor
- Payment processing
- Ticket closed

#### Communication Tracking

**Email Records:**
```typescript
{
  ticketId: number
  direction: 'inbound' | 'outbound'
  from: string
  to: string
  subject: string
  body: string
  attachments: string[]
  sentAt: timestamp
}
```

**Phone Call Records:**
```typescript
{
  ticketId: number
  caller: string (tenant/landlord/contractor/agent)
  duration: number (seconds)
  summary: string (AI-generated from transcript)
  recordingUrl: string (optional)
  outcome: string
  followUpRequired: boolean
  calledAt: timestamp
}
```

#### Contractor Database Schema

```typescript
{
  id: number
  companyName: string
  contactName: string
  email: string
  phone: string
  specialties: string[] // ['plumbing', 'heating', 'electrical']
  certifications: string[] // ['Gas Safe', 'NICEIC', etc.]
  coverage: string[] // Postcodes covered
  rating: decimal (1-5)
  completedJobs: number
  responseTime: number (hours)
  isActive: boolean
  insurance: {
    publicLiability: boolean
    expiryDate: date
  }
}
```

---

### 11.4 Business Owner Dashboard

#### Executive Overview

**Key Metrics (Real-time)**
- Total active listings (sales/rentals/commercial)
- Properties under offer
- Properties let this month
- Properties sold this month
- Total commission this month
- Pipeline value
- Conversion rates

**Sales Property Status Visualization**
```
┌─────────────────────────────────────┐
│  Sales Pipeline                     │
├─────────────────────────────────────┤
│  Valuation Requested: 12            │
│  Listed: 23                         │
│  Under Offer: 8                     │
│  Exchange: 4                        │
│  Sold: 15 (this month)             │
└─────────────────────────────────────┘
```

**Rental Property Status Visualization**
```
┌─────────────────────────────────────┐
│  Rental Portfolio                   │
├─────────────────────────────────────┤
│  Active Tenancies: 87               │
│  Void Properties: 5                 │
│  Upcoming Renewals: 12              │
│  Rent Arrears: 3 properties         │
│  New Lets (this month): 8          │
└─────────────────────────────────────┘
```

**Property Performance Metrics**
- Average days on market (sales): 42 days
- Average days to let: 14 days
- Viewing to offer conversion: 18%
- Offer to completion: 72%
- Void period average: 9 days
- Rent collection rate: 98.5%

**Revenue Analytics**
- Monthly revenue trend (last 12 months)
- Commission breakdown:
  - Sales commission: £XX,XXX
  - Lettings fees: £XX,XXX
  - Management fees: £XX,XXX
  - Additional services: £XX,XXX
- Target vs actual performance
- Revenue forecast (next 3 months)

**Staff Performance Metrics**
- Properties listed per agent
- Viewings conducted
- Offers secured
- Completions achieved
- Customer satisfaction scores
- Response time metrics

**Property Enquiry Analytics**
- Total enquiries this month
- Enquiry source breakdown:
  - Website: 45%
  - Rightmove: 25%
  - Zoopla: 15%
  - Phone: 10%
  - Walk-in: 5%
- Enquiry to viewing conversion: 62%
- Peak enquiry times (hourly/daily)

**Maintenance Analytics**
- Open tickets: 23
- Average resolution time: 4.2 days
- Emergency response time: 2.3 hours
- Top issues: Heating (35%), Plumbing (28%), Electrical (15%)
- Maintenance costs this month: £XX,XXX
- Contractor performance ratings

---

### 11.5 Viewing Management & Booking System

#### Viewing Slot Allocation

**Property-Specific Viewing Slots**
- Sales/Rental managers set available viewing times per property
- Example configuration:
  ```typescript
  {
    propertyId: 123
    availableSlots: [
      { day: 'Monday', times: ['10:00', '14:00', '16:00'] },
      { day: 'Tuesday', times: ['09:00', '11:00', '15:00'] },
      { day: 'Saturday', times: ['10:00', '11:00', '12:00', '14:00', '15:00', '16:00'] }
    ]
    slotDuration: 30 // minutes
    maxViewingsPerDay: 6
  }
  ```

**Calendar Integration**
- Sync with Google Calendar / Outlook
- Block out unavailable times
- Viewing agent assignment
- Conflict detection
- Automated reminders (24h before, 1h before)

**Booking Interface**
- Customer-facing booking widget on property pages
- Real-time availability display
- Instant confirmation
- Virtual viewing option
- In-person viewing option

#### Enquiry Tracking Per Property

**Property Enquiry Dashboard**
```
Property: 123 Portobello Road

Total Enquiries: 47
  - Website Form: 18
  - Phone: 15
  - Email: 10
  - Rightmove: 3
  - Zoopla: 1

Viewings Booked: 23 (48% conversion)
Viewings Conducted: 18 (78% attendance)
Offers Made: 3 (16% conversion)
Offer Accepted: 1

Timeline:
  Listed: 15 days ago
  First Enquiry: 2 hours after listing
  First Viewing: 3 days after listing
  First Offer: 8 days after listing
```

**Analytics Tracking**
```typescript
{
  propertyId: number
  enquiryCount: number
  enquirySources: {
    website: number
    rightmove: number
    zoopla: number
    phone: number
    email: number
    walkIn: number
  }
  viewingsBooked: number
  viewingsConducted: number
  viewingsNoShow: number
  offersReceived: number
  avgResponseTime: number (hours)
  conversionMetrics: {
    enquiryToViewing: decimal
    viewingToOffer: decimal
    offerToAcceptance: decimal
  }
}
```

**Viewing Feedback Collection**
- Post-viewing survey (automated email)
- Agent notes after viewing
- Buyer/tenant interest level (1-5)
- Feedback categories: Price, Condition, Location, Size
- Action items from feedback

---

### 11.6 AI Call Answering & Automatic Viewing Booking

#### AI Call Service Features

**Call Handling Flow:**
1. **Call Received** → Twilio forwards to AI agent
2. **Greeting** → "Hello, you've reached John Barclay Estate & Management. I'm Sarah, how can I help you today?"
3. **Intent Detection** → AI identifies: property inquiry, viewing request, valuation, general question
4. **Context Gathering:**
   - If property inquiry: "Which property are you calling about?"
   - Capture property address/ID
   - Ask about requirements (bedrooms, budget, etc.)
5. **Customer Details Capture:**
   - "May I take your name please?"
   - "What's the best phone number to reach you?"
   - "And your email address?"
   - Save to CRM as lead
6. **Financing Verification:**
   - "Are you a cash buyer or will you need a mortgage?"
   - If mortgage: "Do you have a mortgage in principle?"
   - "Have you sold your current property?"
   - Flag buyers as qualified/unqualified
7. **Viewing Booking:**
   - Check property's available viewing slots
   - "We have slots available on [list 3 nearest options]"
   - Customer selects preferred time
   - Create viewing appointment
   - Assign agent
   - Send confirmation email/SMS
8. **Call Summary:**
   - Automatically creates CRM lead
   - Viewing appointment in calendar
   - Follow-up task for agent
   - Call transcript saved
   - Call recording stored

**Advanced Features:**
- Multi-property comparison handling
- Area recommendations based on budget
- Transfer to human agent if needed
- After-hours call handling
- Multi-language support (future)

**Integration Points:**
- Twilio for call routing
- OpenAI Realtime API for voice conversation
- CRM for lead creation
- Calendar API for viewing bookings
- SendGrid/Twilio for confirmations

---

## Appendix

### Coverage Areas
1. **W2** - Bayswater, Paddington
2. **NW10** - Harlesden, Kensal Green, Kensal Rise, Willesden
3. **W10** - Ladbroke Grove, North Kensington
4. **W9** - Maida Vale
5. **NW6** - Kilburn, Queen's Park
6. **W11** - Notting Hill
7. **NW8** - St. John's Wood
8. **W2** - Westbourne Park

### Key Metrics
- **Properties Managed:** 1000+
- **Years in Business:** 35+
- **Team Size:** 15+
- **Average Days to Let:** 14 days
- **Average Days to Sell:** 42 days
- **Client Satisfaction:** 4.8/5
- **Response Time:** < 2 hours

---

**Document Control**
- **Version:** 1.0
- **Created:** November 18, 2025
- **Author:** Development Team
- **Status:** Active
- **Next Review:** December 2025
