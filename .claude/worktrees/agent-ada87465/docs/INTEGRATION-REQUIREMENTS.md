# John Barclay CRM - External Integration Requirements

## Executive Summary

This document outlines all external integrations required for the John Barclay CRM Agentic AI System. The system operates with a **Supervisor Agent** managing specialized agents for different business functions.

---

## AI Agent Architecture

### Supervisor Agent (Business Manager)
- Oversees all operations
- Routes tasks to appropriate specialist agents
- Makes high-level decisions
- Monitors performance metrics

### Specialist Agents
| Agent | Primary Functions | Communication Channels |
|-------|------------------|----------------------|
| **Office Administration Agent** | Contract management, document handling, scheduling | Email, WhatsApp |
| **Sales Agent** | Property valuations, buyer enquiries, offer negotiation | Email, WhatsApp, Phone |
| **Rental Agent** | Tenant matching, viewing scheduling, tenancy management | Email, WhatsApp |
| **Property Maintenance Agent** | Maintenance tickets, contractor dispatch, inspections | Email, WhatsApp, SMS |
| **Lead Generation Agent (Sales)** | Vendor acquisition, valuation bookings, market analysis | Email, WhatsApp, Social Media |
| **Lead Generation Agent (Rentals)** | Landlord acquisition, tenant sourcing, rental valuations | Email, WhatsApp, Social Media |
| **Marketing Agent** | Social media management, content creation, campaign tracking | Facebook, Instagram, LinkedIn, Twitter |

---

## Integration Status Overview

| Integration | Status | Current State |
|------------|--------|---------------|
| **Twilio (SMS/WhatsApp/Voice)** | ✅ CONFIGURED | Real credentials working |
| **Email (SMTP/IMAP)** | ✅ CONFIGURED | mail.johnbarclay.uk |
| **OpenAI** | ✅ CONFIGURED | GPT-4 for AI features |
| **Supabase (Database)** | ✅ CONFIGURED | PostgreSQL running |
| **Mapbox** | ✅ CONFIGURED | Maps working |
| **DocuSign** | ⚠️ MOCK SERVICE | Needs real API keys |
| **Stripe** | ⚠️ PLACEHOLDER | Needs real API keys |
| **Facebook/Instagram** | ❌ NOT CONFIGURED | Needs setup |
| **LinkedIn** | ❌ NOT CONFIGURED | Needs setup (Marketing Agent) |
| **Twitter/X** | ❌ NOT CONFIGURED | Needs setup (Marketing Agent) |
| **Zoopla/Rightmove** | ⚠️ PARTIAL | Browser automation only |

---

## 1. DocuSign Integration (CONTRACT AUTOMATION)

### What You Need to Provide

**Account Setup:**
1. Create a DocuSign Developer Account: https://developers.docusign.com/
2. Create an Application (Integration Key)
3. Configure OAuth settings

**Required Credentials:**
```env
# Add to .env file
DOCUSIGN_INTEGRATION_KEY=your-integration-key-guid
DOCUSIGN_ACCOUNT_ID=your-account-id
DOCUSIGN_USER_ID=your-user-guid
DOCUSIGN_BASE_PATH=https://demo.docusign.net/restapi  # or https://eu.docusign.net/restapi for production
DOCUSIGN_OAUTH_BASE_PATH=https://account-d.docusign.com  # or account.docusign.com for production
DOCUSIGN_PRIVATE_KEY_PATH=./keys/docusign_private.key
```

**RSA Key Generation:**
```bash
# Generate RSA key pair
openssl genrsa -out docusign_private.key 2048
openssl rsa -in docusign_private.key -pubout -out docusign_public.key
```
- Upload the public key to DocuSign Developer Console
- Store the private key securely on the server

**DocuSign Setup Steps:**
1. Go to https://admindemo.docusign.com/ (or admin.docusign.com for production)
2. Create templates for:
   - Sole Agency Agreement (seller onboarding)
   - Landlord Marketing Agreement
   - Landlord Property Management Agreement
   - Assured Shorthold Tenancy Agreement
   - Inventory Check-In/Check-Out
3. Note the Template IDs for each
4. Configure webhooks to receive signature status updates

**Webhook URL to Configure:**
```
https://johnbarclay.uk/api/webhooks/docusign
```

---

## 2. Stripe Integration (PAYMENTS)

### What You Need to Provide

**Account Setup:**
1. Create a Stripe account: https://dashboard.stripe.com/register
2. Complete business verification
3. Set up bank account for payouts

**Required Credentials:**
```env
# Add to .env file
STRIPE_SECRET_KEY=sk_live_xxx  # Live key for production
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx  # For webhook verification
```

**Stripe Setup Steps:**
1. Go to Stripe Dashboard > Developers > API Keys
2. Copy the Secret Key and Publishable Key
3. Set up webhooks at Developers > Webhooks:
   - Endpoint URL: `https://johnbarclay.uk/api/webhooks/stripe`
   - Events to listen for:
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
     - `invoice.paid`
     - `invoice.payment_failed`
     - `customer.subscription.created`
     - `customer.subscription.deleted`

**Products to Create in Stripe:**
- Property listing fees
- Management service fees
- Referencing fees
- Inventory service fees

---

## 3. Facebook/Instagram Integration (SOCIAL MEDIA INQUIRIES)

### What You Need to Provide

**Account Setup:**
1. Create a Facebook Business Account
2. Create a Meta Developer Account: https://developers.facebook.com/
3. Create a Facebook App
4. Add Instagram Business Account

**Required Credentials:**
```env
# Add to .env file
FACEBOOK_APP_ID=your-app-id
FACEBOOK_APP_SECRET=your-app-secret
FACEBOOK_PAGE_ACCESS_TOKEN=your-page-token
INSTAGRAM_BUSINESS_ACCOUNT_ID=your-instagram-id
META_WEBHOOK_VERIFY_TOKEN=your-custom-verify-token
```

**Meta Setup Steps:**
1. Go to Meta Business Suite
2. Create an App with type "Business"
3. Add the following products:
   - Messenger (for Facebook page messages)
   - Instagram Graph API (for Instagram DMs)
   - Webhooks
4. Generate Page Access Token with these permissions:
   - `pages_messaging`
   - `pages_read_engagement`
   - `instagram_basic`
   - `instagram_manage_messages`
5. Configure Webhooks:
   - Callback URL: `https://johnbarclay.uk/api/webhooks/facebook`
   - Verify Token: (create a custom token)
   - Subscribe to: `messages`, `messaging_postbacks`, `leads`

**Webhook URL to Configure:**
```
https://johnbarclay.uk/api/webhooks/facebook
https://johnbarclay.uk/api/webhooks/instagram
```

---

## 4. Twilio Integration (ALREADY CONFIGURED)

### Current Status: ✅ Working

**Current Credentials in .env:**
```env
TWILIO_ACCOUNT_SID=AC4d7c8e0bf7e98bc43755d06c5d00438b
TWILIO_AUTH_TOKEN=b6c5259fe0d037c858ddd88a5786dd80
TWILIO_PHONE_NUMBER=+442046345656
TWILIO_WHATSAPP_NUMBER=whatsapp:+442046345656
```

**Additional Webhook Configuration Needed:**
1. Go to Twilio Console: https://console.twilio.com/
2. Configure incoming message webhooks:
   - SMS: `https://johnbarclay.uk/api/webhooks/twilio/sms`
   - WhatsApp: `https://johnbarclay.uk/api/webhooks/twilio/whatsapp`
   - Voice: `https://johnbarclay.uk/api/webhooks/twilio/voice`
3. Set Status Callback URLs for delivery tracking

**WhatsApp Business API Setup:**
1. Register WhatsApp Business number with Twilio
2. Create Message Templates for:
   - Viewing confirmations
   - Property alerts
   - Contract signing requests
   - Maintenance updates
3. Submit templates for WhatsApp approval (24hr review)

---

## 5. Email Integration (ALREADY CONFIGURED)

### Current Status: ✅ Working

**Current Credentials in .env:**
```env
IMAP_HOST=mail.johnbarclay.uk
IMAP_PORT=993
IMAP_USER=admin@johnbarclay.uk
IMAP_PASSWORD=admin@johnbarclay.uk
SMTP_HOST=mail.johnbarclay.uk
SMTP_PORT=587
SMTP_USER=admin@johnbarclay.uk
SMTP_PASSWORD=admin@johnbarclay.uk
```

**Recommended Additional Setup:**
1. Create dedicated email addresses for each agent:
   - `sales@johnbarclay.uk` - Sales Agent
   - `lettings@johnbarclay.uk` - Rental Agent
   - `maintenance@johnbarclay.uk` - Maintenance Agent
   - `admin@johnbarclay.uk` - Office Admin Agent
2. Set up email forwarding rules
3. Configure SPF, DKIM, DMARC for deliverability

---

## 6. Property Portal Integration (Zoopla/Rightmove)

### Current Status: ⚠️ Browser Automation (Not API)

**For Official API Access:**

**Zoopla:**
1. Apply for Zoopla API access: https://developer.zoopla.co.uk/
2. Requires estate agent registration
3. Get approved data feed credentials

**Rightmove:**
1. Apply for Real Time Datafeed: https://www.rightmove.co.uk/partners/
2. Requires formal partnership agreement
3. Technical integration certification

**Required Credentials (when approved):**
```env
ZOOPLA_API_KEY=your-zoopla-api-key
ZOOPLA_BRANCH_ID=your-branch-id
RIGHTMOVE_NETWORK_ID=your-network-id
RIGHTMOVE_BRANCH_ID=your-branch-id
RIGHTMOVE_CERTIFICATE=./keys/rightmove.pem
```

**For Now (Browser Automation):**
Store portal login credentials in the admin panel:
- Zoopla Agent Login
- Rightmove Agent Login

---

## 7. LinkedIn Integration (MARKETING AGENT)

### What You Need to Provide

**Account Setup:**
1. Create LinkedIn Company Page
2. Create LinkedIn Developer App: https://www.linkedin.com/developers/
3. Request Marketing API access

**Required Credentials:**
```env
# Add to .env file
LINKEDIN_CLIENT_ID=your-client-id
LINKEDIN_CLIENT_SECRET=your-client-secret
LINKEDIN_ACCESS_TOKEN=your-access-token
LINKEDIN_COMPANY_ID=your-company-urn
```

**LinkedIn Setup Steps:**
1. Go to https://www.linkedin.com/developers/apps
2. Create an app and link to company page
3. Request these API products:
   - Share on LinkedIn
   - Marketing Developer Platform
   - Sign In with LinkedIn using OpenID Connect
4. Generate OAuth 2.0 tokens
5. Note: LinkedIn API has strict approval process

**LinkedIn API Capabilities:**
- Post property listings
- Share market updates
- Track engagement metrics
- Company page analytics

---

## 8. Twitter/X Integration (MARKETING AGENT)

### What You Need to Provide

**Account Setup:**
1. Create Twitter/X Developer Account: https://developer.twitter.com/
2. Apply for Elevated or Basic access
3. Create a Project and App

**Required Credentials:**
```env
# Add to .env file
TWITTER_API_KEY=your-api-key
TWITTER_API_SECRET=your-api-secret
TWITTER_ACCESS_TOKEN=your-access-token
TWITTER_ACCESS_SECRET=your-access-token-secret
TWITTER_BEARER_TOKEN=your-bearer-token
```

**Twitter Setup Steps:**
1. Go to https://developer.twitter.com/en/portal/dashboard
2. Create a Project (select appropriate use case)
3. Create an App within the project
4. Generate API keys and tokens
5. Set up OAuth 2.0 for user authentication

**Twitter API Capabilities:**
- Post property tweets with images
- Respond to mentions
- Track hashtag engagement
- Analytics and metrics

---

## 9. Lead Generation Agent Integration Requirements

### Data Sources for Lead Generation

**Land Registry API:**
- Track recent property sales
- Identify potential sellers
- Market analysis data
```env
LAND_REGISTRY_API_KEY=your-api-key  # Apply via gov.uk
```

**Companies House API:**
- Landlord company identification
- Property ownership research
```env
COMPANIES_HOUSE_API_KEY=your-api-key  # Free registration
```

**Recommended Lead Sources:**
- Property portal inquiries
- Website form submissions
- Social media DMs
- Referral tracking
- Expired listings monitoring

### Lead Scoring Integration
- OpenAI for lead qualification
- Automated follow-up sequences
- Multi-channel outreach coordination

---

## 10. Contractor Marketplace Integration

### Recommended Platforms

**Option 1: Checkatrade API**
- Apply: https://www.checkatrade.com/for-businesses/
- Get API access for contractor lookup
```env
CHECKATRADE_API_KEY=your-api-key
```

**Option 2: MyBuilder API**
- Apply: https://www.mybuilder.com/
- Partner integration for job posting

**Option 3: Build Custom Database**
- Create internal contractor management
- Manual vetting process
- Direct relationships with local contractors

**Recommended Contractor Categories:**
- Cleaning Services (move in/out, regular)
- Plumbing & Heating
- Gas Safe Engineers
- Electricians
- General Builders
- Locksmiths
- Gardeners
- Decorators
- Pest Control
- EPC Assessors
- Inventory Clerks

---

## 8. OpenAI Integration (ALREADY CONFIGURED)

### Current Status: ✅ Working

**Current Credentials in .env:**
```env
OPENAI_API_KEY=sk-proj-xxx
```

**Usage in System:**
- Email classification
- Property description generation
- Lead scoring
- Intelligent routing
- Contract summarization

**Recommended Additional Setup:**
- Create an OpenAI Organization
- Set up usage limits and alerts
- Consider GPT-4 Turbo for cost optimization

---

## Server Configuration Requirements

### Webhook Endpoints to Create

Create these endpoints in your server:

```typescript
// Webhook routes needed
POST /api/webhooks/docusign      // DocuSign signature events
POST /api/webhooks/stripe        // Stripe payment events
POST /api/webhooks/facebook      // Facebook Messenger events
POST /api/webhooks/instagram     // Instagram DM events
POST /api/webhooks/twilio/sms    // SMS incoming messages
POST /api/webhooks/twilio/whatsapp // WhatsApp incoming messages
POST /api/webhooks/twilio/voice  // Voice call events
```

### SSL/HTTPS Requirements
- All webhooks require HTTPS
- Valid SSL certificate on johnbarclay.uk
- Webhook signature verification for security

### Domain Configuration
```
BASE_URL=https://johnbarclay.uk
```

---

## Contract Templates Required

### 1. Sole Agency Engagement Letter (Sales)
- Property details
- Commission rates
- Marketing plan
- Term and notice period
- Seller obligations
- Agent obligations

### 2. Landlord Marketing Agreement
- Property details
- Marketing services
- Fee structure
- Duration
- Withdrawal terms

### 3. Property Management Agreement
- Management scope
- Monthly fee
- Maintenance authorizations
- Emergency procedures
- Reporting schedule

### 4. Assured Shorthold Tenancy Agreement
- Property details
- Tenant details
- Rent and deposit
- Term length
- Break clauses
- Obligations

### 5. Inventory & Schedule of Condition
- Room-by-room checklist
- Photo documentation
- Condition ratings
- Meter readings
- Key inventory

### 6. Check-In Report
- Tenant acknowledgment
- Condition confirmation
- Key handover
- Utility setup

### 7. Check-Out Report
- Condition comparison
- Deductions schedule
- Deposit return

---

## Testing Checklist

### Before Go-Live

- [ ] DocuSign sandbox tested with all templates
- [ ] Stripe test mode payments successful
- [ ] WhatsApp templates approved by Meta
- [ ] Email deliverability tested (check spam scores)
- [ ] Webhook endpoints responding correctly
- [ ] SSL certificate valid and not expiring soon
- [ ] Facebook/Instagram messenger connected
- [ ] All agent email accounts created
- [ ] Contractor database populated
- [ ] AI classification accuracy verified

---

## Cost Estimates (Monthly)

| Service | Estimated Cost |
|---------|---------------|
| Twilio (SMS/WhatsApp) | £50-200 depending on volume |
| DocuSign | £20-40 (per envelope or subscription) |
| Stripe | 1.4% + 20p per transaction |
| OpenAI | £50-100 depending on usage |
| Facebook/Instagram API | Free (within rate limits) |
| Property Portals | Varies (agency agreements) |

---

## Next Steps (Priority Order)

1. **Immediate:** Set up DocuSign developer account and generate API keys
2. **Immediate:** Set up Stripe account and get production keys
3. **This Week:** Create Meta Developer account and Facebook App
4. **This Week:** Configure all webhook endpoints
5. **Next Week:** Create and test contract templates in DocuSign
6. **Next Week:** Submit WhatsApp message templates for approval
7. **Ongoing:** Build contractor database

---

## Support Contacts

For assistance with these integrations:

- **DocuSign:** developer@docusign.com
- **Stripe:** support@stripe.com
- **Meta/Facebook:** developers.facebook.com/support
- **Twilio:** support@twilio.com
- **OpenAI:** support@openai.com

---

*Document Version: 1.0*
*Last Updated: December 2024*
*Prepared for: John Barclay Estate & Management*
