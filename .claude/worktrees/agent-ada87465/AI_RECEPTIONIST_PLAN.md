# AI Receptionist Implementation Plan

## Overview

Build a comprehensive AI-powered receptionist that handles inbound calls via the Twilio number (+447367087752), providing property information, answering queries, capturing leads, and booking viewings - all integrated with the existing CRM.

---

## Current State Analysis

### What Already Exists
1. **aiPhoneService.ts** - Core Twilio + OpenAI voice service with "Sarah" AI agent
2. **voiceAgentService.ts** - Alternative Retell AI implementation
3. **Voice API endpoints** - `/api/voice/inbound`, `/api/voice/process-speech`, `/api/voice/status`
4. **VoiceAgentDashboard** - Frontend UI for monitoring calls
5. **Property lookup** - Basic property search during calls
6. **Viewing booking** - Integration with `viewingAppointments` table

### What Needs Enhancement
1. **More intelligent property lookup** - Better search with rentals vs sales distinction
2. **WhatsApp integration** - Follow-up via WhatsApp after calls
3. **Caller recognition** - Identify existing tenants/landlords/leads
4. **Maintenance ticket creation** - For tenant maintenance calls
5. **Real availability checking** - Check actual viewing slot availability
6. **Better conversation flow** - More natural multi-turn conversations
7. **SMS/WhatsApp confirmations** - After booking viewings
8. **Post-call information delivery** - Send property details via email/WhatsApp
9. **Lead history tracking** - Full conversation and enquiry history for returning callers
10. **All callers saved as leads** - Every caller becomes a lead record with full context

---

## Implementation Plan

### Phase 1: Twilio Webhook Configuration (Day 1)

#### 1.1 Configure Twilio Console
```
Phone Number: +447367087752
Voice Webhook URL: https://johnbarclay.uk/api/voice/inbound (HTTP POST)
Voice Status Callback: https://johnbarclay.uk/api/voice/status (HTTP POST)
SMS Webhook URL: https://johnbarclay.uk/api/webhooks/twilio/sms (HTTP POST)
```

#### 1.2 Update Voice Webhook Endpoints
Ensure the following endpoints are publicly accessible (no auth required):
- `POST /api/voice/inbound` - Receives incoming calls
- `POST /api/voice/process-speech` - Processes speech input
- `POST /api/voice/status` - Call status updates

---

### Phase 2: Enhanced Property Search (Day 1-2)

#### 2.1 Create Voice-Optimized Property Search Function
```typescript
// New function in aiPhoneService.ts
async searchPropertiesForVoice(params: {
  type?: 'rent' | 'sale' | 'any';
  bedrooms?: number;
  maxBedrooms?: number;
  minPrice?: number;
  maxPrice?: number;
  postcode?: string;
  propertyType?: 'flat' | 'house' | 'studio' | 'maisonette';
}): Promise<PropertyVoiceResult[]>
```

#### 2.2 Property Response Formatting
Format property details for natural voice readout:
- "We have a lovely 2-bedroom flat in Queen's Park, available for £2,200 per month"
- "There's a 3-bedroom Victorian house on Ladbroke Grove, asking £1.2 million"

#### 2.3 Property Detail Lookup by Reference
Allow callers to ask about specific properties:
- "Can you tell me more about the property on Elgin Avenue?"
- "What's the status of property reference JB-2024-001?"

---

### Phase 3: Caller Recognition & Context (Day 2)

#### 3.1 Identify Existing Contacts & Load Full History
```typescript
async identifyCaller(phoneNumber: string): Promise<CallerContext> {
  // Check pm_tenants - Is this an existing tenant?
  // Check pm_landlords - Is this a landlord?
  // Check leads table - Previous lead? (PRIMARY CHECK)
  // Check unified_contacts - Any existing contact?

  return {
    isKnown: boolean,
    type: 'tenant' | 'landlord' | 'lead' | 'new',
    leadId?: number,                    // If existing lead
    name?: string,
    email?: string,
    properties?: Property[],            // Their properties if landlord/tenant

    // FULL LEAD HISTORY
    previousCalls?: CallHistory[],      // All previous call transcripts
    previousEnquiries?: Enquiry[],      // What they asked about before
    propertiesViewed?: Property[],      // Properties they've seen
    propertiesSentInfo?: Property[],    // Properties we sent details for
    savedSearchCriteria?: {             // Their preferences
      type: 'rent' | 'buy';
      bedrooms?: number;
      maxBudget?: number;
      preferredAreas?: string[];
    },
    viewingHistory?: ViewingAppointment[],
    openTickets?: MaintenanceTicket[],
    lastContactDate?: Date,
    preferredContactMethod?: 'phone' | 'email' | 'whatsapp'
  };
}
```

#### 3.2 Personalized Greetings with Context
- **Known tenant**: "Hello [Name], I can see you're a tenant at [Property]. How can I help you today?"
- **Known landlord**: "Good morning [Name], thank you for calling. Are you calling about your property at [Address]?"
- **Returning lead (rental)**: "Hi [Name], welcome back! Last time we spoke you were looking for a [2-bed flat in W9 around £2,000]. I have some new properties that might interest you - would you like to hear about them?"
- **Returning lead (sale)**: "Hello [Name], good to hear from you again. You were interested in properties in [Queen's Park] up to [£800,000]. Have your requirements changed at all?"
- **Lead who viewed properties**: "Hi [Name]! How did the viewing go at [Property Address]? Are you still interested, or would you like to see more options?"
- **New caller**: "Hello, thank you for calling John Barclay Estate and Management. I'm Sarah, how can I help you today?"

#### 3.3 Context Injection for AI
When a known lead calls, inject their full history into the AI system prompt:
```typescript
const leadContextPrompt = `
CALLER HISTORY - ${lead.name} (${lead.phone}):
- Previous calls: ${lead.previousCalls.length} calls
- Looking for: ${lead.savedSearchCriteria?.type} - ${lead.savedSearchCriteria?.bedrooms} bed in ${lead.savedSearchCriteria?.preferredAreas?.join(', ')}
- Budget: Up to £${lead.savedSearchCriteria?.maxBudget?.toLocaleString()}
- Properties discussed before: ${lead.propertiesViewed?.map(p => p.addressLine1).join(', ')}
- Properties we sent info about: ${lead.propertiesSentInfo?.map(p => p.addressLine1).join(', ')}
- Last contact: ${lead.lastContactDate}
- Preferred contact: ${lead.preferredContactMethod}

Use this context to provide personalized service. Reference their previous interests naturally.
`;
```

---

### Phase 4: Intent Classification & Routing (Day 2-3)

#### 4.1 Call Intent Categories
```typescript
type CallIntent =
  | 'property_enquiry_rent'      // Looking to rent
  | 'property_enquiry_buy'       // Looking to buy
  | 'book_viewing'               // Book a property viewing
  | 'book_valuation'             // Request property valuation
  | 'tenant_maintenance'         // Report maintenance issue
  | 'tenant_general'             // General tenant enquiry
  | 'landlord_enquiry'           // Landlord questions
  | 'existing_viewing'           // Enquiry about booked viewing
  | 'speak_to_agent'             // Wants human agent
  | 'office_hours'               // Asking about hours
  | 'general_enquiry'            // Other
```

#### 4.2 Intent Detection Prompts
Add system prompts to help OpenAI classify intent:
```
Based on the conversation, classify the caller's primary intent as one of:
- RENT: Looking for rental properties
- BUY: Looking to purchase
- VIEWING: Wants to book a viewing
- VALUATION: Wants property valuation
- MAINTENANCE: Tenant reporting issue
- AGENT: Wants to speak to human
- OTHER: General enquiry
```

---

### Phase 5: Viewing Booking System (Day 3-4)

#### 5.1 Real-Time Availability Check
```typescript
async getAvailableViewingSlots(params: {
  propertyId: number;
  preferredDate?: Date;
  daysAhead?: number; // Default 7
}): Promise<ViewingSlot[]> {
  // Check existing appointments
  // Check agent availability
  // Return available 30-minute slots
  // Business hours: 9am-6pm Mon-Sat
}
```

#### 5.2 Viewing Booking Flow
```
1. Caller expresses interest in property
2. AI confirms which property
3. AI checks availability
4. AI offers: "I have slots available tomorrow at 10am, 11:30am, or 3pm. Which works best for you?"
5. Caller chooses time
6. AI collects: Full name, email, phone (if not known)
7. AI confirms: "I've booked you in for [Property] at [Time]. You'll receive a confirmation shortly."
8. System creates viewing appointment
9. System sends SMS/WhatsApp confirmation
```

#### 5.3 Viewing Confirmation Message
```typescript
async sendViewingConfirmation(viewing: ViewingAppointment): Promise<void> {
  const message = `
    Viewing Confirmed! 🏠

    Property: ${viewing.propertyAddress}
    Date: ${formatDate(viewing.scheduledDate)}
    Time: ${formatTime(viewing.scheduledDate)}

    Your agent will meet you at the property.

    Need to reschedule? Call us on +44 7367 087752

    John Barclay Estate & Management
  `;

  // Send via SMS
  await twilioClient.messages.create({
    to: viewing.viewerPhone,
    from: TWILIO_PHONE_NUMBER,
    body: message
  });

  // Also send via WhatsApp if they have it
  await twilioClient.messages.create({
    to: `whatsapp:${viewing.viewerPhone}`,
    from: `whatsapp:${TWILIO_PHONE_NUMBER}`,
    body: message
  });
}
```

---

### Phase 6: Tenant Maintenance Support (Day 4)

#### 6.1 Maintenance Intent Detection
Detect when a tenant is calling about maintenance:
- "I have a problem with..."
- "Something is broken..."
- "The boiler isn't working..."
- "There's a leak..."
- "The heating is off..."

#### 6.2 Maintenance Ticket Creation
```typescript
async createMaintenanceFromCall(params: {
  callSid: string;
  tenantId: number;
  propertyId: number;
  description: string;
  urgency: 'emergency' | 'urgent' | 'normal';
  category: string;
}): Promise<MaintenanceTicket> {
  // Create ticket in support_tickets table
  // Assign to property manager
  // Send confirmation to tenant
  // Alert landlord if emergency
}
```

#### 6.3 Emergency Escalation
For emergencies (gas leak, flood, no heat in winter):
- Immediately alert on-call staff
- Send SMS to property manager
- Create high-priority ticket
- Provide tenant with emergency contractor number

---

### Phase 7: Lead Capture & CRM Integration (Day 5)

#### 7.1 ALL CALLERS SAVED AS LEADS
**Every single caller is saved as a lead** - no exceptions. This ensures:
- Full history available when they call back
- No lost opportunities
- Complete audit trail

```typescript
interface VoiceLead {
  id: number;
  source: 'phone_call' | 'whatsapp' | 'email';

  // Contact info (REQUIRED - AI must collect)
  phone: string;                        // From caller ID
  name: string;                         // AI asks for this
  email?: string;                       // AI asks for this

  // All call history
  calls: CallRecord[];                  // Every call stored
  totalCalls: number;
  firstCallDate: Date;
  lastCallDate: Date;

  // Requirements (updated each call)
  lookingFor: 'rent' | 'buy' | 'both' | 'undecided';
  propertyType?: string;
  bedrooms?: { min: number; max?: number };
  budget?: { min?: number; max: number };
  preferredAreas?: string[];            // W9, W10, NW6, etc.
  moveInDate?: Date;
  mustHaves?: string[];                 // Garden, parking, etc.
  dealBreakers?: string[];              // No ground floor, etc.

  // Properties discussed
  propertiesDiscussed: PropertyInteraction[];  // All properties mentioned
  propertiesSentInfo: number[];         // Property IDs we sent details for
  propertiesViewed: number[];           // Property IDs they viewed
  propertiesFavourited: number[];       // Properties they liked

  // Qualification
  hasDeposit?: boolean;
  isFirstTimeBuyer?: boolean;
  mortgageApproved?: boolean;
  currentSituation?: string;            // Renting, owns, etc.
  reasonForMoving?: string;

  // Lead scoring (auto-calculated)
  urgency: 'immediate' | 'within_month' | 'within_3_months' | 'browsing';
  temperature: 'hot' | 'warm' | 'cold';
  score: number;                        // 0-100

  // Preferences
  preferredContactMethod: 'phone' | 'email' | 'whatsapp';
  bestTimeToCall?: string;
  doNotCallBefore?: string;             // e.g., "10am"
  doNotCallAfter?: string;              // e.g., "6pm"

  // Assignment
  assignedAgentId?: number;

  // Status
  status: 'new' | 'contacted' | 'qualified' | 'viewing_booked' | 'offer_made' | 'converted' | 'lost';

  createdAt: Date;
  updatedAt: Date;
}

interface CallRecord {
  callSid: string;
  date: Date;
  duration: number;
  direction: 'inbound' | 'outbound';
  transcript: string;
  aiSummary: string;
  intent: string;
  propertiesDiscussed: number[];
  actionsTaken: string[];               // 'viewing_booked', 'info_sent', etc.
  followUpRequired: boolean;
  followUpNotes?: string;
}

interface PropertyInteraction {
  propertyId: number;
  firstMentioned: Date;
  timesDiscussed: number;
  interest: 'high' | 'medium' | 'low' | 'rejected';
  viewingBooked?: Date;
  viewingCompleted?: Date;
  feedback?: string;
  infoSentDate?: Date;
  infoSentVia?: 'email' | 'whatsapp' | 'both';
}
```

#### 7.2 Post-Call Processing
After EVERY call:
1. **Save/Update Lead Record**
   - Create new lead if phone number not found
   - Update existing lead with new information
   - Append call record to history

2. **Analyze transcript with GPT**
   ```typescript
   const analysis = await analyzeCallTranscript(transcript);
   // Returns: summary, intent, requirements_extracted, properties_discussed,
   //          lead_score, follow_up_actions, info_to_send
   ```

3. **Update lead requirements**
   - Merge new requirements with existing (don't overwrite unless changed)
   - Track changes over time

4. **Record properties discussed**
   - Link properties to lead
   - Track interest level per property

5. **Trigger follow-up actions**
   - Send requested information (see Phase 7A)
   - Create tasks for agents
   - Schedule callbacks

6. **Score the lead**
   ```typescript
   function calculateLeadScore(lead: VoiceLead): number {
     let score = 50; // Base score

     // Engagement
     score += lead.totalCalls * 5;                    // +5 per call
     score += lead.propertiesViewed.length * 10;     // +10 per viewing

     // Qualification
     if (lead.mortgageApproved) score += 15;
     if (lead.hasDeposit) score += 10;
     if (lead.budget?.max) score += 5;

     // Urgency
     if (lead.urgency === 'immediate') score += 20;
     if (lead.urgency === 'within_month') score += 10;

     // Recency
     const daysSinceContact = daysBetween(lead.lastCallDate, new Date());
     if (daysSinceContact < 7) score += 10;
     if (daysSinceContact > 30) score -= 10;

     return Math.min(100, Math.max(0, score));
   }
   ```

---

### Phase 7A: Post-Call Information Delivery (Day 5)

#### 7A.1 Offer to Send Information
During the call, AI should offer to send details:
```
AI: "I can send you the full details of these properties including photos,
     floor plans, and pricing. Would you prefer that by email or WhatsApp?"

Caller: "WhatsApp please"

AI: "Perfect. And can I confirm your email address in case you'd like
     a copy there too? It's also useful for sending viewing confirmations."
```

#### 7A.2 Information Package Types

**Property Details Package:**
```typescript
interface PropertyInfoPackage {
  properties: Array<{
    id: number;
    address: string;
    price: string;
    bedrooms: number;
    bathrooms: number;
    propertyType: string;
    description: string;
    features: string[];
    images: string[];          // URLs
    floorPlan?: string;        // URL
    epc?: string;              // URL
    virtualTour?: string;      // URL
    availableFrom?: Date;
  }>;

  // Personalized intro
  recipientName: string;
  searchCriteria: string;      // "2-bed flats in W9 up to £2,000/month"

  // Call to action
  viewingCTA: boolean;         // Include "Book a viewing" button
  agentContact: {
    name: string;
    phone: string;
    email: string;
  };
}
```

**Viewing Confirmation Package:**
- Property details
- Date, time, address
- Map/directions
- Agent meeting them
- What to bring (ID, proof of funds)

**Valuation Package:**
- Confirmation of appointment
- What to expect
- Recent sales in area (teaser)

#### 7A.3 Delivery Methods

**WhatsApp Delivery:**
```typescript
async sendPropertyInfoWhatsApp(to: string, package: PropertyInfoPackage) {
  // Send intro message
  await twilioClient.messages.create({
    to: `whatsapp:${to}`,
    from: TWILIO_WHATSAPP_NUMBER,
    body: `Hi ${package.recipientName}! 👋

As promised, here are the properties we discussed:
${package.searchCriteria}

I'm sending ${package.properties.length} properties that match your criteria...`
  });

  // Send each property as a card with image
  for (const property of package.properties) {
    await twilioClient.messages.create({
      to: `whatsapp:${to}`,
      from: TWILIO_WHATSAPP_NUMBER,
      body: `🏠 *${property.address}*
💰 ${property.price}
🛏️ ${property.bedrooms} bed | 🛁 ${property.bathrooms} bath

${property.description.substring(0, 200)}...

✨ ${property.features.slice(0, 3).join(' • ')}`,
      mediaUrl: [property.images[0]]  // Primary image
    });

    // Small delay to maintain order
    await sleep(500);
  }

  // Send CTA
  await twilioClient.messages.create({
    to: `whatsapp:${to}`,
    from: TWILIO_WHATSAPP_NUMBER,
    body: `📅 *Ready to view?*
Reply "BOOK" to schedule a viewing, or call us on +44 7367 087752

${package.agentContact.name}
John Barclay Estate & Management`
  });

  // Record that info was sent
  await recordInfoSent(to, package.properties.map(p => p.id), 'whatsapp');
}
```

**Email Delivery:**
```typescript
async sendPropertyInfoEmail(to: string, package: PropertyInfoPackage) {
  const html = generatePropertyEmailTemplate(package);

  await emailService.send({
    to,
    subject: `${package.properties.length} Properties Matching Your Search - John Barclay`,
    html,
    attachments: package.properties.map(p => ({
      filename: `${p.address.replace(/[^a-z0-9]/gi, '_')}_floorplan.pdf`,
      path: p.floorPlan
    })).filter(a => a.path)
  });

  // Record that info was sent
  await recordInfoSent(to, package.properties.map(p => p.id), 'email');
}
```

#### 7A.4 Automatic Triggers
Info is sent automatically when:
1. Call ends and properties were discussed
2. Caller explicitly requests it
3. Viewing is booked (confirmation)
4. New property matches saved search criteria (proactive)

#### 7A.5 Track What Was Sent
```typescript
// Update lead record
lead.propertiesSentInfo.push(...propertyIds);

// Update property interactions
for (const propertyId of propertyIds) {
  const interaction = lead.propertiesDiscussed.find(p => p.propertyId === propertyId);
  if (interaction) {
    interaction.infoSentDate = new Date();
    interaction.infoSentVia = method;
  }
}
```

---

### Phase 8: WhatsApp Integration (Day 5-6)

#### 8.1 WhatsApp Webhook Setup
```typescript
// POST /api/webhooks/whatsapp
async handleWhatsAppMessage(req: Request, res: Response) {
  const { From, Body, MessageSid } = req.body;

  // Identify sender
  const caller = await identifyCaller(From);

  // Process message with AI
  const response = await processWhatsAppMessage(caller, Body);

  // Reply
  await twilioClient.messages.create({
    to: From,
    from: TWILIO_WHATSAPP_NUMBER,
    body: response
  });
}
```

#### 8.2 WhatsApp Capabilities
- Property search: "Show me 2 bed flats in W9"
- Viewing booking: "I'd like to book a viewing"
- Maintenance reports: "My heating isn't working" (with photo support)
- Document sharing: Send property brochures, contracts
- Viewing reminders: Automated reminders 24h before

---

### Phase 9: Human Handoff (Day 6)

#### 9.1 Detect Handoff Triggers
- Caller explicitly asks: "Can I speak to someone?"
- Complex enquiry AI can't handle
- Complaint or escalation
- Large transaction (over £2M)
- VIP client flag

#### 9.2 Graceful Handoff
```
AI: "I'd be happy to connect you with one of our agents. Just a moment..."

[If agent available]
- Transfer call
- Send agent context summary via dashboard/Slack

[If no agent available]
AI: "Our agents are currently with other clients. Can I take your details
     and have someone call you back within the hour?"
- Capture callback request
- Create urgent follow-up task
- Send SMS confirming callback time
```

---

### Phase 10: Analytics & Monitoring (Day 7)

#### 10.1 Call Analytics Dashboard
Track:
- Total calls per day/week/month
- Average call duration
- Call outcomes (viewing booked, lead captured, etc.)
- Top enquiry types
- Busiest times
- Conversion rates
- Customer satisfaction (post-call survey)

#### 10.2 AI Performance Metrics
- Intent classification accuracy
- Response relevance scores
- Handoff rate
- Issue resolution rate
- Lead quality scores

---

## Technical Requirements

### Environment Variables Needed
```env
# Already configured
TWILIO_ACCOUNT_SID=ACf1ca44f87cba7e5d9f11b3e26fcb7c39
TWILIO_AUTH_TOKEN=9acdc18dc38d6d3ef4569a12208907f3
TWILIO_PHONE_NUMBER=+447367087752
TWILIO_WHATSAPP_NUMBER=whatsapp:+447367087752
OPENAI_API_KEY=sk-proj-...
BASE_URL=https://JohnBarclay.uk

# May need to add
TWILIO_VOICE_WEBHOOK_URL=https://JohnBarclay.uk/api/voice/inbound
EMERGENCY_CONTACT_PHONE=+44...
SLACK_WEBHOOK_URL=https://hooks.slack.com/... (for alerts)
```

### Database Tables Used
- `properties` - Property search
- `pm_properties` - Managed properties
- `pm_tenants` - Tenant identification
- `pm_landlords` - Landlord identification
- `viewing_appointments` - Booking viewings
- `support_tickets` - Maintenance tickets
- `unified_contacts` - Contact lookup

### NEW: `voice_leads` Table (Required)
```sql
CREATE TABLE voice_leads (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(20) NOT NULL UNIQUE,      -- Primary identifier
  name VARCHAR(255),
  email VARCHAR(255),

  -- What they're looking for
  looking_for VARCHAR(20),                 -- 'rent', 'buy', 'both', 'undecided'
  property_type VARCHAR(50),               -- 'flat', 'house', 'studio', etc.
  bedrooms_min INTEGER,
  bedrooms_max INTEGER,
  budget_min INTEGER,
  budget_max INTEGER,
  preferred_areas TEXT[],                  -- ['W9', 'W10', 'NW6']
  move_in_date DATE,
  must_haves TEXT[],                       -- ['garden', 'parking']
  deal_breakers TEXT[],                    -- ['ground floor']

  -- Qualification
  has_deposit BOOLEAN,
  is_first_time_buyer BOOLEAN,
  mortgage_approved BOOLEAN,
  current_situation VARCHAR(100),          -- 'renting', 'owns', etc.
  reason_for_moving TEXT,

  -- Lead scoring
  urgency VARCHAR(20),                     -- 'immediate', 'within_month', etc.
  temperature VARCHAR(10),                 -- 'hot', 'warm', 'cold'
  score INTEGER DEFAULT 50,

  -- Contact preferences
  preferred_contact_method VARCHAR(20) DEFAULT 'phone',
  best_time_to_call VARCHAR(50),
  do_not_call_before TIME,
  do_not_call_after TIME,

  -- Assignment & Status
  assigned_agent_id INTEGER REFERENCES users(id),
  status VARCHAR(30) DEFAULT 'new',

  -- Timestamps
  first_call_date TIMESTAMP,
  last_call_date TIMESTAMP,
  total_calls INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_voice_leads_phone ON voice_leads(phone);
CREATE INDEX idx_voice_leads_status ON voice_leads(status);
CREATE INDEX idx_voice_leads_score ON voice_leads(score DESC);
```

### NEW: `voice_lead_calls` Table (Call History)
```sql
CREATE TABLE voice_lead_calls (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER REFERENCES voice_leads(id) ON DELETE CASCADE,
  call_sid VARCHAR(50) UNIQUE,
  direction VARCHAR(10),                   -- 'inbound', 'outbound'
  duration INTEGER,                        -- seconds
  transcript TEXT,
  ai_summary TEXT,
  intent VARCHAR(50),
  properties_discussed INTEGER[],          -- Property IDs
  actions_taken TEXT[],                    -- ['viewing_booked', 'info_sent']
  follow_up_required BOOLEAN DEFAULT FALSE,
  follow_up_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_voice_lead_calls_lead ON voice_lead_calls(lead_id);
```

### NEW: `voice_lead_properties` Table (Property Interactions)
```sql
CREATE TABLE voice_lead_properties (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER REFERENCES voice_leads(id) ON DELETE CASCADE,
  property_id INTEGER REFERENCES properties(id),
  first_mentioned TIMESTAMP DEFAULT NOW(),
  times_discussed INTEGER DEFAULT 1,
  interest VARCHAR(10),                    -- 'high', 'medium', 'low', 'rejected'
  viewing_booked_date TIMESTAMP,
  viewing_completed_date TIMESTAMP,
  feedback TEXT,
  info_sent_date TIMESTAMP,
  info_sent_via VARCHAR(20),               -- 'email', 'whatsapp', 'both'
  UNIQUE(lead_id, property_id)
);

CREATE INDEX idx_voice_lead_properties_lead ON voice_lead_properties(lead_id);
```

### External Services
- **Twilio Voice** - Call handling
- **Twilio SMS** - Confirmations
- **Twilio WhatsApp** - WhatsApp messaging
- **OpenAI GPT-4** - Conversation AI
- **Amazon Polly** - Text-to-speech (via Twilio)

---

## File Changes Required

### New Files
1. `server/aiReceptionistService.ts` - Enhanced AI receptionist logic
2. `server/whatsappService.ts` - WhatsApp message handling
3. `client/src/pages/AIReceptionistDashboard.tsx` - Enhanced monitoring UI

### Modified Files
1. `server/aiPhoneService.ts` - Enhance property search, add caller ID
2. `server/crmRoutes.ts` - Add WhatsApp webhooks, viewing availability API
3. `shared/schema.ts` - Add call_logs table if needed

---

## Testing Plan

### Unit Tests
- Property search with various criteria
- Caller identification
- Intent classification
- Viewing slot availability
- Lead scoring algorithm

### Integration Tests
- Full call flow simulation
- Twilio webhook handling
- Database operations
- SMS/WhatsApp sending

### End-to-End Tests
- Call the number, test full conversation
- Book a viewing via phone
- Report maintenance via phone
- WhatsApp conversation flow

---

## Rollout Plan

### Week 1: Core Enhancement
- Days 1-2: Twilio config, enhanced property search
- Days 3-4: Caller recognition, viewing booking
- Days 5-7: Testing & refinement

### Week 2: Extended Features
- Days 1-2: Maintenance support
- Days 3-4: WhatsApp integration
- Days 5-7: Analytics, monitoring, polish

### Go-Live Checklist
- [ ] Twilio webhooks configured
- [ ] SSL certificate valid on BASE_URL
- [ ] OpenAI API key active
- [ ] Test calls completed successfully
- [ ] Viewing booking creates records
- [ ] SMS confirmations sending
- [ ] Staff trained on dashboard
- [ ] Emergency escalation tested
- [ ] Analytics dashboard working

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Call answer rate | 100% |
| Average response time | < 2 seconds |
| Intent classification accuracy | > 90% |
| Viewing booking conversion | > 30% |
| Lead capture rate | > 80% |
| Customer satisfaction | > 4.5/5 |
| Human handoff rate | < 15% |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| AI gives wrong information | Human review of transcripts, easy handoff |
| High call volume | Twilio scales automatically, queue system |
| OpenAI downtime | Fallback to basic IVR menu |
| Caller frustration | Quick handoff to human option |
| Data privacy | GDPR compliance, call recording consent |

---

## Next Steps

1. **Confirm requirements** - Review this plan, prioritize features
2. **Set up Twilio webhooks** - Configure phone number to hit our endpoints
3. **Test existing flow** - Verify current aiPhoneService works
4. **Implement enhancements** - Phase by phase development
5. **Deploy & monitor** - Go live with close monitoring

Would you like me to proceed with implementation?
