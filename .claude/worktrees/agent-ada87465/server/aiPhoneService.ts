import twilio from 'twilio';
import { db } from './db';
import {
  properties,
  viewingAppointments,
  propertyWorkflows,
  customerEnquiries,
  users,
  voiceCallRecords,
  leads
} from '@shared/schema';
import { eq, and, gte, lte, like, or, sql } from 'drizzle-orm';
import { WebSocketServer, WebSocket } from 'ws';
import { openaiClient, isOpenAIConfigured } from './lib/openaiClient';
import { voiceLeadService } from './voiceLeadService';

// Initialize clients
const openai = openaiClient;

const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

// Call state management
interface ActiveCall {
  callSid: string;
  from: string;
  to: string;
  direction: 'inbound' | 'outbound';
  startTime: Date;
  status: 'ringing' | 'in-progress' | 'completed' | 'failed';
  conversationHistory: { role: 'system' | 'user' | 'assistant'; content: string }[];
  context: any;
  transcript: string[];
  // Lead tracking
  leadId?: number;
  isReturningCaller: boolean;
  leadHistory?: any;
  callRecordId?: number;
  propertiesDiscussed: number[];
  infoRequestedVia?: 'email' | 'whatsapp' | 'both';
}

class AIPhoneService {
  private activeCalls: Map<string, ActiveCall> = new Map();
  private wsServer: WebSocketServer | null = null;

  // System prompt for the AI agent
  private readonly SYSTEM_PROMPT = `You are Sarah, a professional and friendly estate agent at John Barclay Estate & Management in West London.

Your responsibilities:
1. Answer property enquiries warmly and professionally
2. Provide accurate property details (price, bedrooms, location, features)
3. Book property viewings and valuations
4. Qualify leads by understanding budget, timeline, and requirements
5. Capture contact details for follow-up
6. Handle landlord enquiries about property management services
7. Gather property details FROM landlord wanting to let their property
8. Handle both SALES and RENTAL enquiries with appropriate questions

Key information:
- Office hours: 9am-6pm Monday to Saturday
- Covered areas: W9, W10, W11, NW6, NW10 (Maida Vale, Queen's Park, Notting Hill, Kilburn)
- Viewing slots: Every 30 minutes during office hours
- Valuations: Free service, 45-minute appointments
- Emergency maintenance: Available 24/7 for tenants

=== AREA KNOWLEDGE - USE THIS TO HELP CALLERS ===

**W9 - Maida Vale/Little Venice:**
- Premium residential area known for elegant Victorian and Edwardian mansion flats
- Little Venice: Beautiful canal-side living with cafes and water buses to Camden
- Transport: Warwick Avenue (Bakerloo), Maida Vale (Bakerloo), Paddington (15 min walk)
- Schools: North Westminster Community School, St Joseph's RC Primary
- Character: Quiet, leafy streets, perfect for professionals and families
- Typical prices: £500-800/week rental, £600k-1.5m sales
- Key roads: Elgin Avenue, Randolph Avenue, Castellain Road, Warwick Avenue

**W10 - North Kensington/Queen's Park:**
- Diverse, vibrant area with excellent community feel
- Queen's Park: Village atmosphere with independent shops and cafes
- Transport: Queen's Park (Bakerloo, Overground), Ladbroke Grove (Hammersmith & City)
- Schools: Queen's Park Primary (Outstanding Ofsted), Ark Franklin Primary
- Character: Mix of Victorian terraces and modern developments, great for families
- Typical prices: £400-650/week rental, £500k-1.2m sales
- Key roads: Chamberlayne Road, Harrow Road, Kilburn Lane

**W11 - Notting Hill:**
- World-famous area with stunning architecture and cosmopolitan atmosphere
- Famous for: Portobello Road Market, Notting Hill Carnival, boutique shops
- Transport: Notting Hill Gate (Central, Circle, District), Ladbroke Grove
- Schools: Bassett House, Fox Primary, Thomas Jones Primary
- Character: Iconic pastel-coloured houses, celebrity residents, excellent restaurants
- Typical prices: £600-1200/week rental, £1m-3m+ sales
- Key roads: Portobello Road, Westbourne Grove, Ledbury Road, Ladbroke Grove

**NW6 - Kilburn/West Hampstead:**
- Up-and-coming area with excellent transport and value for money
- West Hampstead: Trendy high street with restaurants and bars
- Transport: Kilburn (Jubilee), West Hampstead (Jubilee, Thameslink, Overground)
- Schools: Emmanuel CE Primary, Kingsgate Primary
- Character: Victorian conversions, younger professionals, good value
- Typical prices: £350-550/week rental, £450k-900k sales
- Key roads: Kilburn High Road, West End Lane, Mill Lane

**NW10 - Kensal Green/Harlesden:**
- Emerging area with excellent regeneration and transport links
- Kensal Rise: Popular with young families, great cafes on Chamberlayne Road
- Transport: Kensal Green (Bakerloo, Overground), Harlesden (Bakerloo, Overground)
- Schools: Princess Frederica CE Primary, Kensal Rise Primary
- Character: Good value, improving rapidly, strong community
- Typical prices: £300-450/week rental, £400k-800k sales
- Key roads: Chamberlayne Road, College Road, Station Terrace

=== RENTAL ENQUIRY FLOW ===
When someone calls about renting a property:
1. Determine what they're looking for:
   - Number of bedrooms required
   - Preferred areas (mention the areas we cover)
   - Budget per month or per week
   - Move-in date/timeline
   - Any specific requirements (parking, garden, pets, etc.)
2. Check if they are working professionals or students
3. Ask about their current situation (where are they living now)
4. Offer to send matching properties via email or WhatsApp
5. If they mention a specific property, provide details and offer a viewing
6. For viewings: take their name, best contact number, email, and preferred times
7. Mention that references and credit checks are required for rentals

=== SALES ENQUIRY FLOW ===
When someone calls about buying a property:
1. Determine what they're looking for:
   - Number of bedrooms
   - Preferred areas (mention the areas we cover)
   - Maximum budget
   - Property type preference (flat, house, maisonette)
   - Any specific requirements (garden, parking, period features)
2. Qualifying questions:
   - Are they a first-time buyer or have they sold before?
   - Do they have a property to sell? (chain status)
   - Are they pre-approved for a mortgage or cash buyer?
   - What's their timeline to purchase?
3. If they have a property to sell, offer our free valuation service
4. Offer to send matching properties via email or WhatsApp
5. If they mention a specific property, provide details and offer a viewing
6. For viewings: take their name, best contact number, email, and preferred times

=== VALUATION REQUESTS ===
When someone wants a free valuation:
1. Get the property address and postcode
2. Property type (flat, house, etc.) and approximate size
3. Reason for valuation (thinking of selling, remortgage, inheritance, etc.)
4. Their timeline
5. Best contact details and preferred time for the valuer to visit
6. Valuations are free and take about 45 minutes
7. A property expert will visit to assess the property and provide a written valuation

=== PROPERTY MANAGEMENT SERVICES ===
When a landlord calls about renting out their property, explain our services:

**Full Management Service (12% + VAT of monthly rent):**
- Tenant finding and referencing
- Rent collection and arrears management
- 24/7 maintenance coordination
- Regular property inspections (quarterly)
- Deposit protection and registration
- Tenancy agreement preparation
- Inventory and check-in/check-out
- Compliance management (gas safety, EPC, electrical)
- Monthly statements and annual tax summaries

**Tenant Find Only Service (1 month's rent + VAT):**
- Professional marketing on all major portals
- Accompanied viewings
- Comprehensive tenant referencing
- Tenancy agreement preparation
- Deposit registration
- Inventory preparation
- Check-in with tenant

**Our Expertise:**
- Over 20 years experience in West London lettings
- Dedicated property managers for each property
- In-house maintenance team for quick repairs
- Average time to let: 2-3 weeks
- 98% rent collection rate
- Fully compliant with all landlord regulations

=== LANDLORD ENQUIRY FLOW ===
When a landlord wants to let their property:
1. Thank them and express interest
2. Ask about the property:
   - Property address (full address and postcode)
   - Property type (flat, house, studio, maisonette)
   - Number of bedrooms and bathrooms
   - Is it furnished, part-furnished, or unfurnished?
   - Current condition - does it need any work?
   - Is it currently tenanted or vacant?
   - When would it be available to let?
   - Do they have an idea of the rent they're hoping for?
3. Ask about their requirements:
   - Are they looking for full management or tenant find only?
   - Have they let property before?
   - Are there any tenant preferences? (professionals, families, etc.)
4. Explain you'll arrange for a property manager to contact them
5. Confirm their name, best contact number, and email
6. Ask when is best to call them back
7. Let them know a property manager will call within 2 hours (during office hours)

If they want to speak to someone immediately:
- During office hours: Offer to transfer them to a property manager
- Outside hours: Take details and promise callback first thing next morning

=== EXISTING LANDLORD/TENANT CALLS ===
If caller identifies as an existing landlord or tenant:
- For maintenance issues: Log the issue, confirm the property address, get description of problem
- For rent queries: Take details and have accounts team call back
- For emergencies (leaks, no heating, security issues): Escalate immediately

Communication style:
- Be warm, professional, and helpful
- Use natural conversational language
- Keep responses concise (2-3 sentences typically)
- Ask clarifying questions when needed
- Always aim to book an appointment or capture details
- If unsure about specific details, offer to have a specialist call back

When booking appointments:
- Confirm name, phone number, and email
- Suggest available time slots
- Explain what to expect during the viewing/valuation

Remember: You represent a premium London estate agency. Be helpful but not pushy.`;

  constructor() {
    console.log('AI Phone Service initialized');
  }

  /**
   * Initialize WebSocket server for real-time audio streaming
   */
  initializeWebSocket(server: any) {
    this.wsServer = new WebSocketServer({ server, path: '/voice-stream' });

    this.wsServer.on('connection', (ws: WebSocket, req: any) => {
      console.log('Voice stream connection established');

      ws.on('message', async (message: Buffer) => {
        try {
          const data = JSON.parse(message.toString());
          await this.handleStreamMessage(ws, data);
        } catch (error) {
          console.error('Error handling stream message:', error);
        }
      });

      ws.on('close', () => {
        console.log('Voice stream connection closed');
      });
    });

    console.log('WebSocket server initialized for voice streaming');
  }

  /**
   * Handle incoming voice stream messages
   */
  private async handleStreamMessage(ws: WebSocket, data: any) {
    const { event, callSid, speech } = data;

    switch (event) {
      case 'connected':
        console.log(`Call ${callSid} connected`);
        break;

      case 'start':
        console.log(`Media stream started for ${callSid}`);
        break;

      case 'speech':
        // Process user speech
        if (speech && speech.trim()) {
          const response = await this.processUserSpeech(callSid, speech);
          if (response) {
            ws.send(JSON.stringify({
              event: 'speak',
              text: response
            }));
          }
        }
        break;

      case 'stop':
        console.log(`Media stream stopped for ${callSid}`);
        break;
    }
  }

  /**
   * Handle inbound call webhook from Twilio
   */
  async handleInboundCall(callData: any): Promise<string> {
    const callSid = callData.CallSid;
    const from = callData.From;
    const to = callData.To;

    console.log(`Inbound call from ${from} to ${to}`);

    // Check if this is a returning caller
    const leadHistory = await voiceLeadService.findLeadByPhone(from);
    const isReturningCaller = leadHistory !== null;

    // Create call record in database
    const callRecordId = await voiceLeadService.saveCallRecord({
      callSid,
      direction: 'inbound',
      callerPhone: from,
      agentPhone: to,
      startedAt: new Date(),
      status: 'in_progress',
      leadId: leadHistory?.lead.id
    });

    // Build system prompt with lead context
    let systemPrompt = this.SYSTEM_PROMPT;
    if (isReturningCaller && leadHistory) {
      const contextInfo = voiceLeadService.generateContextFromHistory(leadHistory);
      systemPrompt += `\n\n--- CALLER HISTORY ---\n${contextInfo}\n--- END HISTORY ---\n\nThis is a returning caller. Greet them by name and reference their previous enquiries naturally.`;
    }

    // Create call record
    const call: ActiveCall = {
      callSid,
      from,
      to,
      direction: 'inbound',
      startTime: new Date(),
      status: 'in-progress',
      conversationHistory: [
        { role: 'system', content: systemPrompt }
      ],
      context: {},
      transcript: [],
      leadId: leadHistory?.lead.id,
      isReturningCaller,
      leadHistory,
      callRecordId,
      propertiesDiscussed: []
    };

    this.activeCalls.set(callSid, call);

    // Generate personalized greeting
    let greeting: string;
    if (isReturningCaller && leadHistory) {
      const firstName = leadHistory.lead.fullName.split(' ')[0];
      if (leadHistory.previousCalls.length > 0) {
        greeting = `Hello ${firstName}, thank you for calling John Barclay Estate and Management again! I'm Sarah. I have your details here from our previous conversation. How can I help you today?`;
      } else {
        greeting = `Hello ${firstName}, thank you for calling John Barclay Estate and Management. I'm Sarah. I can see you've been in touch with us before. How can I help you today?`;
      }
    } else {
      greeting = "Hello, thank you for calling John Barclay Estate and Management. I'm Sarah, how can I help you today?";
    }

    // Store greeting in history
    call.conversationHistory.push({ role: 'assistant', content: greeting });
    call.transcript.push(`Agent: ${greeting}`);

    // Return TwiML with Gather for speech input
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy">${greeting}</Say>
  <Gather input="speech" action="/api/voice/process-speech" method="POST" speechTimeout="auto" language="en-GB">
    <Say voice="Polly.Amy">I'm listening...</Say>
  </Gather>
  <Say voice="Polly.Amy">I didn't catch that. Please try again.</Say>
  <Redirect>/api/voice/inbound</Redirect>
</Response>`;
  }

  /**
   * Process speech input from Twilio
   */
  async handleSpeechInput(speechData: any): Promise<string> {
    const callSid = speechData.CallSid;
    const speechResult = speechData.SpeechResult;

    if (!speechResult) {
      return this.generateContinueListening(callSid);
    }

    const call = this.activeCalls.get(callSid);
    if (!call) {
      return this.generateErrorResponse();
    }

    // Add user input to history
    call.conversationHistory.push({ role: 'user', content: speechResult });
    call.transcript.push(`Customer: ${speechResult}`);

    // Process with OpenAI
    const response = await this.generateAIResponse(call);

    // Add AI response to history
    call.conversationHistory.push({ role: 'assistant', content: response });
    call.transcript.push(`Agent: ${response}`);

    // Check if we need to perform any actions
    await this.checkForActions(call, speechResult, response);

    // Check for end-of-call signals
    if (this.shouldEndCall(speechResult)) {
      return this.generateGoodbye(call, response);
    }

    // Continue conversation
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy">${this.escapeXml(response)}</Say>
  <Gather input="speech" action="/api/voice/process-speech" method="POST" speechTimeout="auto" language="en-GB">
  </Gather>
  <Say voice="Polly.Amy">Are you still there?</Say>
  <Gather input="speech" action="/api/voice/process-speech" method="POST" speechTimeout="3" language="en-GB">
  </Gather>
  <Say voice="Polly.Amy">I'll let you go. Thank you for calling John Barclay. Goodbye!</Say>
  <Hangup/>
</Response>`;
  }

  /**
   * Generate AI response using OpenAI
   */
  private async generateAIResponse(call: ActiveCall): Promise<string> {
    try {
      // Add context about available properties if relevant
      const contextMessage = await this.getPropertyContext(call);
      if (contextMessage) {
        call.conversationHistory.push({
          role: 'system',
          content: contextMessage
        });
      }

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: call.conversationHistory as any,
        temperature: 0.7,
        max_tokens: 150,
        presence_penalty: 0.6,
        frequency_penalty: 0.3
      });

      return completion.choices[0].message.content || "I apologize, I didn't quite catch that. Could you please repeat?";
    } catch (error) {
      console.error('Error generating AI response:', error);
      return "I'm experiencing a brief technical issue. Let me take your details and have someone call you back shortly.";
    }
  }

  /**
   * Get property context based on conversation
   */
  private async getPropertyContext(call: ActiveCall): Promise<string | null> {
    const lastMessage = call.conversationHistory[call.conversationHistory.length - 1];
    if (lastMessage.role !== 'user') return null;

    const userInput = lastMessage.content.toLowerCase();

    // Check if user is asking about properties
    const propertyKeywords = ['property', 'flat', 'house', 'bedroom', 'rent', 'buy', 'sale', 'available', 'looking for', 'searching'];
    const isPropertyQuery = propertyKeywords.some(keyword => userInput.includes(keyword));

    if (!isPropertyQuery) return null;

    // Determine if this is a rental or sales enquiry
    const rentalKeywords = ['rent', 'rental', 'to let', 'let', 'per week', 'pcm', 'per month', 'tenancy', 'renting'];
    const salesKeywords = ['buy', 'buying', 'purchase', 'for sale', 'selling', 'mortgage', 'first time buyer', 'freehold', 'leasehold'];

    const isRentalEnquiry = rentalKeywords.some(keyword => userInput.includes(keyword));
    const isSalesEnquiry = salesKeywords.some(keyword => userInput.includes(keyword));

    // Track enquiry type for the call context
    if (isRentalEnquiry && !call.context.enquiryType) {
      call.context.enquiryType = 'rental';
    } else if (isSalesEnquiry && !call.context.enquiryType) {
      call.context.enquiryType = 'sales';
    }

    try {
      // Extract potential criteria
      const bedroomMatch = userInput.match(/(\d+)\s*bed/);
      const bedrooms = bedroomMatch ? parseInt(bedroomMatch[1]) : undefined;

      const postcodeMatch = userInput.match(/\b(w9|w10|w11|nw6|nw10)\b/i);
      const postcode = postcodeMatch ? postcodeMatch[1].toUpperCase() : undefined;

      // Extract budget if mentioned
      const budgetMatch = userInput.match(/(?:£|budget\s*(?:of\s*)?|around\s*|up\s*to\s*)(\d{1,3}(?:,?\d{3})*(?:\.\d{2})?)\s*(?:k|thousand|pw|per\s*week|pcm|per\s*month)?/i);
      if (budgetMatch) {
        let budget = parseInt(budgetMatch[1].replace(/,/g, ''));
        // Check if it's in thousands (k)
        if (userInput.includes('k') || budget < 10000) {
          budget = budget * 1000;
        }
        call.context.callerBudget = budget;
      }

      // Extract area names mentioned
      const areaNames = ['maida vale', 'little venice', 'queen\'s park', 'queens park', 'notting hill',
                         'kilburn', 'west hampstead', 'kensal green', 'kensal rise', 'harlesden'];
      const mentionedAreas = areaNames.filter(area => userInput.includes(area));
      if (mentionedAreas.length > 0) {
        call.context.preferredAreas = mentionedAreas;
      }

      let allProperties: any[] = [];

      // Query from main properties table
      const mainConditions = [eq(properties.status, 'active')];

      // Filter by listing type if we know the enquiry type
      if (isRentalEnquiry) {
        mainConditions.push(eq(properties.isRental, true));
      } else if (isSalesEnquiry) {
        mainConditions.push(eq(properties.isRental, false));
      }

      if (bedrooms) {
        mainConditions.push(gte(properties.bedrooms, bedrooms));
      }

      if (postcode) {
        mainConditions.push(like(properties.postcode, `${postcode}%`));
      }

      const mainResults = await db.select()
        .from(properties)
        .where(and(...mainConditions))
        .limit(5);

      // Format main properties results
      for (const p of mainResults) {
        const priceFormatted = p.isRental
          ? `£${Math.round(p.price / 100).toLocaleString()} pw`
          : `£${(p.price / 100).toLocaleString()}`;

        allProperties.push({
          id: p.id,
          source: 'listings',
          address: `${p.addressLine1}, ${p.postcode}`,
          price: priceFormatted,
          priceValue: p.price,
          type: p.propertyType,
          bedrooms: p.bedrooms,
          bathrooms: p.bathrooms,
          isRental: p.isRental,
          features: p.features?.slice(0, 3).join(', '),
          tenure: p.tenure,
          description: p.description?.substring(0, 200)
        });
      }

      // Also check properties table for rentals (using isRental flag)
      if (isRentalEnquiry || (!isRentalEnquiry && !isSalesEnquiry)) {
        try {
          const rentalConditions = [
            eq(properties.isRental, true),
            eq(properties.isListed, true),
            sql`${properties.bedrooms} IS NOT NULL`
          ];

          if (bedrooms) {
            rentalConditions.push(gte(properties.bedrooms, bedrooms));
          }

          if (postcode) {
            rentalConditions.push(like(properties.postcode, `${postcode}%`));
          }

          const rentalResults = await db.select()
            .from(properties)
            .where(and(...rentalConditions))
            .limit(5);

          for (const p of rentalResults) {
            // Avoid duplicates if already in main listings
            if (!allProperties.some(existing => existing.address === p.address)) {
              allProperties.push({
                id: p.id,
                source: 'managed',
                address: p.address || `${p.addressLine1}, ${p.postcode}`,
                price: p.rentAmount ? `£${(p.rentAmount / 100).toLocaleString()} ${p.rentPeriod || 'pcm'}` : 'Price on application',
                priceValue: p.rentAmount || 0,
                type: p.propertyType,
                bedrooms: p.bedrooms,
                bathrooms: p.bathrooms,
                isRental: true,
                features: p.features?.slice(0, 3).join(', '),
                description: p.description?.substring(0, 200)
              });
            }
          }
        } catch (err) {
          console.log('Rental properties query skipped:', err);
        }
      }

      // Also check properties table for sales (using isRental=false flag)
      if (isSalesEnquiry || (!isRentalEnquiry && !isSalesEnquiry)) {
        try {
          const saleConditions = [
            eq(properties.isRental, false),
            eq(properties.isListed, true),
            sql`${properties.bedrooms} IS NOT NULL`
          ];

          if (bedrooms) {
            saleConditions.push(gte(properties.bedrooms, bedrooms));
          }

          if (postcode) {
            saleConditions.push(like(properties.postcode, `${postcode}%`));
          }

          const saleResults = await db.select()
            .from(properties)
            .where(and(...saleConditions))
            .limit(5);

          for (const p of saleResults) {
            if (!allProperties.some(existing => existing.address === p.address)) {
              allProperties.push({
                id: p.id,
                source: 'managed',
                address: p.address || `${p.addressLine1}, ${p.postcode}`,
                price: p.price ? `£${(p.price / 100).toLocaleString()}` : 'Price on application',
                priceValue: p.price || 0,
                type: p.propertyType,
                bedrooms: p.bedrooms,
                bathrooms: p.bathrooms,
                isRental: false,
                features: p.features?.slice(0, 3).join(', '),
                description: p.description?.substring(0, 200)
              });
            }
          }
        } catch (err) {
          console.log('Sale properties query skipped:', err);
        }
      }

      if (allProperties.length === 0) {
        // Return area advice even if no properties match
        if (postcode || mentionedAreas.length > 0) {
          const areaAdvice = this.getAreaAdvice(postcode || (mentionedAreas[0] || ''));
          if (areaAdvice) {
            return `No exact property matches found, but you can provide area information: ${areaAdvice}. Offer to register the caller's requirements and notify them when matching properties become available.`;
          }
        }
        return null;
      }

      // Limit to top 3 most relevant
      allProperties = allProperties.slice(0, 3);

      call.context.matchedProperties = allProperties;

      // Track properties discussed in this call
      for (const prop of allProperties) {
        if (!call.propertiesDiscussed.includes(prop.id)) {
          call.propertiesDiscussed.push(prop.id);
        }
      }

      // Build context message
      const enquiryTypeLabel = isRentalEnquiry ? 'RENTAL' : isSalesEnquiry ? 'SALE' : 'available';
      let contextMessage = `=== ${enquiryTypeLabel.toUpperCase()} PROPERTIES MATCHING QUERY ===\n`;

      contextMessage += allProperties.map(p => {
        const typeLabel = p.isRental ? '(TO LET)' : '(FOR SALE)';
        return `- [ID: ${p.id}] ${p.bedrooms} bed ${p.type} ${typeLabel} at ${p.address} - ${p.price}${p.features ? ` | Features: ${p.features}` : ''}${p.tenure ? ` | ${p.tenure}` : ''}`;
      }).join('\n');

      contextMessage += `\n\nMention these properties naturally in your response. Provide specific details like price, bedrooms, and location.`;
      contextMessage += `\nIf the caller wants more details or photos sent to them, ask if they prefer email or WhatsApp.`;

      if (isRentalEnquiry) {
        contextMessage += `\nFor rental viewings, mention that references and credit checks will be required.`;
      } else if (isSalesEnquiry) {
        contextMessage += `\nFor sales viewings, ask about their buying position (mortgage approved? chain status?).`;
      }

      return contextMessage;

    } catch (error) {
      console.error('Error fetching property context:', error);
      return null;
    }
  }

  /**
   * Get area advice based on postcode or area name
   */
  private getAreaAdvice(areaInput: string): string | null {
    const input = areaInput.toLowerCase();

    if (input.includes('w9') || input.includes('maida') || input.includes('little venice')) {
      return 'W9 Maida Vale is a premium residential area with elegant Victorian mansion flats. Little Venice offers beautiful canal-side living. Transport: Warwick Avenue (Bakerloo line). Typical rentals £500-800/week, sales £600k-1.5m';
    }
    if (input.includes('w10') || input.includes('queen') || input.includes('north kensington')) {
      return 'W10 Queen\'s Park has a village atmosphere with excellent schools and independent shops. Great for families. Transport: Queen\'s Park (Bakerloo, Overground). Typical rentals £400-650/week, sales £500k-1.2m';
    }
    if (input.includes('w11') || input.includes('notting')) {
      return 'W11 Notting Hill is world-famous for its stunning architecture and Portobello Road Market. Premium location with excellent restaurants. Transport: Notting Hill Gate (Central, Circle, District). Typical rentals £600-1200/week, sales £1m-3m+';
    }
    if (input.includes('nw6') || input.includes('kilburn') || input.includes('west hampstead')) {
      return 'NW6 Kilburn and West Hampstead offer excellent value with great transport links. West Hampstead has a trendy high street. Transport: Kilburn/West Hampstead (Jubilee). Typical rentals £350-550/week, sales £450k-900k';
    }
    if (input.includes('nw10') || input.includes('kensal')) {
      return 'NW10 Kensal Green/Kensal Rise is an emerging area popular with young families. Chamberlayne Road has great cafes. Transport: Kensal Green (Bakerloo, Overground). Typical rentals £300-450/week, sales £400k-800k';
    }

    return null;
  }

  /**
   * Check for actionable items in the conversation
   */
  private async checkForActions(call: ActiveCall, userInput: string, aiResponse: string): Promise<void> {
    const input = userInput.toLowerCase();
    const response = aiResponse.toLowerCase();

    // Check for booking intent
    if (this.detectBookingIntent(input, response)) {
      await this.handleBookingIntent(call);
    }

    // Check for valuation intent
    if (this.detectValuationIntent(input)) {
      call.context.valuationIntent = true;
    }

    // Check for rental enquiry intent
    if (this.detectRentalIntent(input)) {
      call.context.enquiryType = 'rental';
      call.context.isRentalEnquiry = true;
      this.extractRentalRequirements(call, input);
    }

    // Check for sales/buying enquiry intent
    if (this.detectSalesIntent(input)) {
      call.context.enquiryType = 'sales';
      call.context.isSalesEnquiry = true;
      this.extractSalesRequirements(call, input);
    }

    // Check for landlord/property management intent
    if (this.detectLandlordIntent(input)) {
      call.context.isLandlord = true;
      call.context.landlordIntent = true;
      await this.handleLandlordEnquiry(call, input);
    }

    // Check for maintenance/tenant issue
    if (this.detectMaintenanceIntent(input)) {
      call.context.maintenanceIssue = true;
      await this.handleMaintenanceEnquiry(call, input);
    }

    // Check for contact capture
    if (this.detectContactInfo(input)) {
      await this.captureContactInfo(call, input);
    }

    // Extract property details if landlord is providing them
    if (call.context.isLandlord) {
      this.extractLandlordPropertyDetails(call, input);
    }

    // Check for info delivery request (WhatsApp or Email)
    if (this.detectInfoDeliveryRequest(input)) {
      if (input.includes('whatsapp') || input.includes('text') || input.includes('message')) {
        call.infoRequestedVia = call.infoRequestedVia === 'email' ? 'both' : 'whatsapp';
        call.context.sendInfoVia = 'whatsapp';
      } else if (input.includes('email') || input.includes('e-mail')) {
        call.infoRequestedVia = call.infoRequestedVia === 'whatsapp' ? 'both' : 'email';
        call.context.sendInfoVia = 'email';
      }
    }

    // Check for transfer/callback request
    if (this.detectTransferRequest(input)) {
      call.context.wantsTransfer = true;
    }
  }

  /**
   * Detect rental enquiry intent
   */
  private detectRentalIntent(input: string): boolean {
    const rentalKeywords = [
      'rent', 'renting', 'to rent', 'looking to rent', 'want to rent',
      'rental', 'rentals', 'to let', 'properties to let',
      'per week', 'per month', 'pcm', 'pw', 'tenancy',
      'move in', 'moving in', 'available to rent'
    ];
    return rentalKeywords.some(keyword => input.includes(keyword));
  }

  /**
   * Detect sales/buying enquiry intent
   */
  private detectSalesIntent(input: string): boolean {
    const salesKeywords = [
      'buy', 'buying', 'purchase', 'purchasing', 'looking to buy',
      'for sale', 'properties for sale', 'want to buy',
      'first time buyer', 'first-time buyer', 'mortgage',
      'cash buyer', 'chain free', 'freehold', 'leasehold',
      'invest', 'investment'
    ];
    return salesKeywords.some(keyword => input.includes(keyword));
  }

  /**
   * Extract rental requirements from conversation
   */
  private extractRentalRequirements(call: ActiveCall, input: string): void {
    if (!call.context.rentalRequirements) {
      call.context.rentalRequirements = {};
    }
    const req = call.context.rentalRequirements;

    // Extract bedrooms
    const bedroomMatch = input.match(/(\d+)\s*(?:bed|bedroom|br)/i);
    if (bedroomMatch) {
      req.bedrooms = parseInt(bedroomMatch[1]);
    }

    // Extract budget (weekly or monthly)
    const weeklyBudgetMatch = input.match(/(?:£|budget\s*(?:of\s*)?)(\d{2,4})\s*(?:pw|per\s*week|a\s*week|weekly)/i);
    const monthlyBudgetMatch = input.match(/(?:£|budget\s*(?:of\s*)?)(\d{3,5})\s*(?:pcm|per\s*month|a\s*month|monthly)/i);

    if (weeklyBudgetMatch) {
      req.budgetPerWeek = parseInt(weeklyBudgetMatch[1]);
      req.budgetPerMonth = req.budgetPerWeek * 52 / 12;
    } else if (monthlyBudgetMatch) {
      req.budgetPerMonth = parseInt(monthlyBudgetMatch[1]);
      req.budgetPerWeek = Math.round(req.budgetPerMonth * 12 / 52);
    }

    // Extract move-in timeline
    if (input.includes('immediately') || input.includes('asap') || input.includes('right away') || input.includes('now')) {
      req.moveInTimeline = 'immediate';
    } else if (input.includes('next month') || input.includes('in a month')) {
      req.moveInTimeline = 'within_month';
    } else if (input.includes('couple of weeks') || input.includes('two weeks') || input.includes('2 weeks')) {
      req.moveInTimeline = 'within_2_weeks';
    }

    // Extract tenant type
    if (input.includes('professional') || input.includes('working')) {
      req.tenantType = 'professional';
    } else if (input.includes('student')) {
      req.tenantType = 'student';
    } else if (input.includes('family') || input.includes('children') || input.includes('kids')) {
      req.tenantType = 'family';
    } else if (input.includes('couple')) {
      req.tenantType = 'couple';
    }

    // Extract furnished preference
    if (input.includes('unfurnished')) {
      req.furnished = 'unfurnished';
    } else if (input.includes('part furnished') || input.includes('part-furnished')) {
      req.furnished = 'part_furnished';
    } else if (input.includes('furnished')) {
      req.furnished = 'furnished';
    }

    // Extract specific requirements
    if (input.includes('parking') || input.includes('car space')) {
      req.needsParking = true;
    }
    if (input.includes('garden') || input.includes('outdoor space')) {
      req.needsGarden = true;
    }
    if (input.includes('pet') || input.includes('dog') || input.includes('cat')) {
      req.hasPets = true;
    }

    // Extract preferred areas
    const areaNames = ['maida vale', 'little venice', 'queen\'s park', 'queens park', 'notting hill',
                       'kilburn', 'west hampstead', 'kensal green', 'kensal rise', 'harlesden',
                       'w9', 'w10', 'w11', 'nw6', 'nw10'];
    const mentionedAreas = areaNames.filter(area => input.includes(area));
    if (mentionedAreas.length > 0) {
      req.preferredAreas = [...(req.preferredAreas || []), ...mentionedAreas];
    }
  }

  /**
   * Extract sales/buying requirements from conversation
   */
  private extractSalesRequirements(call: ActiveCall, input: string): void {
    if (!call.context.salesRequirements) {
      call.context.salesRequirements = {};
    }
    const req = call.context.salesRequirements;

    // Extract bedrooms
    const bedroomMatch = input.match(/(\d+)\s*(?:bed|bedroom|br)/i);
    if (bedroomMatch) {
      req.bedrooms = parseInt(bedroomMatch[1]);
    }

    // Extract budget
    const budgetMatch = input.match(/(?:£|budget\s*(?:of\s*)?|up\s*to\s*|around\s*)(\d{1,3}(?:,?\d{3})*)\s*(?:k|thousand|million)?/i);
    if (budgetMatch) {
      let budget = parseInt(budgetMatch[1].replace(/,/g, ''));
      if (input.includes('million') || input.includes('m ')) {
        budget = budget * 1000000;
      } else if (input.includes('k') || input.includes('thousand') || budget < 10000) {
        budget = budget * 1000;
      }
      req.maxBudget = budget;
    }

    // Extract buyer status
    if (input.includes('first time buyer') || input.includes('first-time buyer')) {
      req.buyerType = 'first_time_buyer';
      req.hasPropertyToSell = false;
    }
    if (input.includes('cash buyer') || input.includes('cash purchase')) {
      req.buyerType = 'cash_buyer';
      req.isCashBuyer = true;
    }
    if (input.includes('mortgage') || input.includes('approved') || input.includes('agreement in principle')) {
      req.hasMortgageApproval = true;
    }

    // Extract chain status
    if (input.includes('chain free') || input.includes('no chain')) {
      req.chainStatus = 'chain_free';
    } else if (input.includes('selling') || input.includes('need to sell') || input.includes('property to sell')) {
      req.hasPropertyToSell = true;
      req.chainStatus = 'in_chain';
    } else if (input.includes('sold stc') || input.includes('sold subject')) {
      req.chainStatus = 'sold_stc';
      req.hasPropertyToSell = true;
    }

    // Extract timeline
    if (input.includes('immediately') || input.includes('asap') || input.includes('urgent')) {
      req.timeline = 'immediate';
    } else if (input.includes('next few months') || input.includes('couple of months')) {
      req.timeline = 'within_3_months';
    } else if (input.includes('just looking') || input.includes('browsing')) {
      req.timeline = 'browsing';
    }

    // Extract property type preference
    if (input.includes('flat') || input.includes('apartment')) {
      req.propertyType = 'flat';
    } else if (input.includes('house')) {
      req.propertyType = 'house';
    } else if (input.includes('maisonette')) {
      req.propertyType = 'maisonette';
    }

    // Extract tenure preference
    if (input.includes('freehold')) {
      req.tenurePreference = 'freehold';
    } else if (input.includes('leasehold')) {
      req.tenurePreference = 'leasehold';
    } else if (input.includes('share of freehold')) {
      req.tenurePreference = 'share_of_freehold';
    }

    // Extract specific requirements
    if (input.includes('parking') || input.includes('car space')) {
      req.needsParking = true;
    }
    if (input.includes('garden') || input.includes('outdoor space')) {
      req.needsGarden = true;
    }
    if (input.includes('period') || input.includes('victorian') || input.includes('edwardian')) {
      req.wantsPeriodProperty = true;
    }

    // Extract preferred areas
    const areaNames = ['maida vale', 'little venice', 'queen\'s park', 'queens park', 'notting hill',
                       'kilburn', 'west hampstead', 'kensal green', 'kensal rise', 'harlesden',
                       'w9', 'w10', 'w11', 'nw6', 'nw10'];
    const mentionedAreas = areaNames.filter(area => input.includes(area));
    if (mentionedAreas.length > 0) {
      req.preferredAreas = [...(req.preferredAreas || []), ...mentionedAreas];
    }
  }

  /**
   * Detect landlord/property management intent
   */
  private detectLandlordIntent(input: string): boolean {
    const landlordKeywords = [
      'landlord', 'let my property', 'rent my property', 'rent out my',
      'letting my', 'want to let', 'looking to let', 'manage my property',
      'property management', 'tenant find', 'find tenants', 'find a tenant',
      'i have a property', 'i own a property', 'my property',
      'let out my flat', 'let out my house', 'rent my flat', 'rent my house',
      'need a tenant', 'looking for tenants', 'property to rent out',
      'rental income', 'buy to let', 'investment property'
    ];
    return landlordKeywords.some(keyword => input.includes(keyword));
  }

  /**
   * Detect maintenance/tenant issue intent
   */
  private detectMaintenanceIntent(input: string): boolean {
    const maintenanceKeywords = [
      'maintenance', 'repair', 'broken', 'not working', 'leak', 'leaking',
      'boiler', 'heating', 'hot water', 'no heating', 'damp', 'mould', 'mold',
      'blocked', 'drain', 'toilet', 'sink', 'shower', 'window', 'door',
      'lock', 'key', 'locked out', 'emergency', 'urgent', 'tenant',
      'i am a tenant', "i'm a tenant", 'my landlord', 'report a problem',
      'something is broken', 'need fixing', 'needs repair'
    ];
    return maintenanceKeywords.some(keyword => input.includes(keyword));
  }

  /**
   * Detect transfer/speak to someone request
   */
  private detectTransferRequest(input: string): boolean {
    const transferKeywords = [
      'speak to someone', 'talk to someone', 'speak to a person',
      'transfer me', 'put me through', 'connect me', 'real person',
      'human', 'agent', 'manager', 'speak now', 'talk now', 'right now',
      'immediately', 'urgent'
    ];
    return transferKeywords.some(keyword => input.includes(keyword));
  }

  /**
   * Handle landlord enquiry - mark for staff callback
   */
  private async handleLandlordEnquiry(call: ActiveCall, input: string): Promise<void> {
    if (!call.context.landlordEnquiryLogged) {
      call.context.landlordEnquiryLogged = true;
      call.context.callbackRequired = true;
      call.context.callbackDepartment = 'property_management';
      call.context.callbackPriority = 'high';

      console.log(`Landlord enquiry detected for call ${call.callSid}`);
    }
  }

  /**
   * Handle maintenance enquiry - log issue
   */
  private async handleMaintenanceEnquiry(call: ActiveCall, input: string): Promise<void> {
    if (!call.context.maintenanceLogged) {
      call.context.maintenanceLogged = true;
      call.context.callbackRequired = true;
      call.context.callbackDepartment = 'maintenance';

      // Check for emergency keywords
      const emergencyKeywords = ['emergency', 'urgent', 'flood', 'fire', 'gas', 'no heating', 'locked out', 'leak'];
      const isEmergency = emergencyKeywords.some(keyword => input.includes(keyword));
      call.context.callbackPriority = isEmergency ? 'emergency' : 'normal';
      call.context.isEmergency = isEmergency;

      console.log(`Maintenance issue detected for call ${call.callSid}, emergency: ${isEmergency}`);
    }
  }

  /**
   * Extract property details from landlord conversation
   */
  private extractLandlordPropertyDetails(call: ActiveCall, input: string): void {
    if (!call.context.landlordPropertyDetails) {
      call.context.landlordPropertyDetails = {};
    }

    const details = call.context.landlordPropertyDetails;

    // Extract postcode
    const postcodeMatch = input.match(/\b([A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2})\b/i);
    if (postcodeMatch) {
      details.postcode = postcodeMatch[1].toUpperCase();
    }

    // Extract bedrooms
    const bedroomMatch = input.match(/(\d+)\s*(?:bed|bedroom|br)/i);
    if (bedroomMatch) {
      details.bedrooms = parseInt(bedroomMatch[1]);
    }

    // Extract bathrooms
    const bathroomMatch = input.match(/(\d+)\s*(?:bath|bathroom)/i);
    if (bathroomMatch) {
      details.bathrooms = parseInt(bathroomMatch[1]);
    }

    // Extract property type
    const propertyTypes = ['flat', 'apartment', 'house', 'studio', 'maisonette', 'bungalow', 'cottage'];
    for (const type of propertyTypes) {
      if (input.includes(type)) {
        details.propertyType = type;
        break;
      }
    }

    // Extract furnished status
    if (input.includes('unfurnished')) {
      details.furnished = 'unfurnished';
    } else if (input.includes('part furnished') || input.includes('part-furnished')) {
      details.furnished = 'part_furnished';
    } else if (input.includes('furnished')) {
      details.furnished = 'furnished';
    }

    // Extract rent expectation
    const rentMatch = input.match(/£?\s*(\d{1,2}[,.]?\d{3})\s*(?:per month|pcm|a month|monthly)?/i);
    if (rentMatch) {
      details.expectedRent = parseInt(rentMatch[1].replace(/[,\.]/g, ''));
    }

    // Extract management preference
    if (input.includes('full management') || input.includes('fully managed')) {
      details.serviceType = 'full_management';
    } else if (input.includes('tenant find') || input.includes('find only')) {
      details.serviceType = 'tenant_find';
    }

    // Extract availability
    if (input.includes('now') || input.includes('immediately') || input.includes('asap')) {
      details.availableNow = true;
    } else if (input.includes('vacant') || input.includes('empty')) {
      details.isVacant = true;
    } else if (input.includes('tenanted') || input.includes('tenant in')) {
      details.currentlyTenanted = true;
    }
  }

  /**
   * Detect if caller is requesting information to be sent
   */
  private detectInfoDeliveryRequest(input: string): boolean {
    const infoKeywords = [
      'send me', 'email me', 'whatsapp me', 'text me', 'message me',
      'send details', 'send information', 'send the info',
      'can you email', 'can you send', 'can you text',
      'via email', 'via whatsapp', 'by email', 'by whatsapp',
      'more details', 'property details'
    ];
    return infoKeywords.some(keyword => input.includes(keyword));
  }

  /**
   * Detect booking intent
   */
  private detectBookingIntent(input: string, response: string): boolean {
    const bookingKeywords = ['book', 'viewing', 'see the property', 'visit', 'appointment', 'come and see'];
    return bookingKeywords.some(keyword => input.includes(keyword) || response.includes(keyword));
  }

  /**
   * Detect valuation intent
   */
  private detectValuationIntent(input: string): boolean {
    const valuationKeywords = ['valuation', 'value my', 'worth', 'sell my', 'selling', 'how much'];
    return valuationKeywords.some(keyword => input.includes(keyword));
  }

  /**
   * Detect contact information in speech
   */
  private detectContactInfo(input: string): boolean {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
    const phoneRegex = /\b(?:0\d{10}|\+44\d{10})\b/;
    const nameMatch = input.match(/(?:my name is|i'm|this is)\s+([A-Za-z\s]+)/i);

    return emailRegex.test(input) || phoneRegex.test(input) || nameMatch !== null;
  }

  /**
   * Capture contact information
   */
  private async captureContactInfo(call: ActiveCall, input: string): Promise<void> {
    const emailMatch = input.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    const phoneMatch = input.match(/\b(?:0\d{10}|\+44\d{10})\b/);
    const nameMatch = input.match(/(?:my name is|i'm|this is)\s+([A-Za-z\s]+)/i);

    if (emailMatch) call.context.customerEmail = emailMatch[0];
    if (phoneMatch) call.context.customerPhone = phoneMatch[0];
    if (nameMatch) call.context.customerName = nameMatch[1].trim();
  }

  /**
   * Handle booking intent
   */
  private async handleBookingIntent(call: ActiveCall): Promise<void> {
    call.context.bookingIntent = true;

    // If we have property context and customer info, create a lead
    if (call.context.matchedProperties?.length > 0 && call.context.customerName) {
      try {
        await db.insert(customerEnquiries).values({
          source: 'phone',
          sourceDetails: 'AI Voice Agent',
          customerName: call.context.customerName || 'Phone Caller',
          customerEmail: call.context.customerEmail || '',
          customerPhone: call.from,
          enquiryType: 'buying',
          message: `Property viewing interest from AI call. Transcript: ${call.transcript.join('\n')}`,
          status: 'new',
          leadScore: 80,
          leadTemperature: 'hot',
          autoResponseSent: false
        });
      } catch (error) {
        console.error('Error creating enquiry from call:', error);
      }
    }
  }

  /**
   * Check if call should end
   */
  private shouldEndCall(input: string): boolean {
    const endPhrases = ['goodbye', 'bye', 'thank you goodbye', 'thanks bye', "that's all", 'nothing else'];
    return endPhrases.some(phrase => input.toLowerCase().includes(phrase));
  }

  /**
   * Generate goodbye response
   */
  private generateGoodbye(call: ActiveCall, lastResponse: string): string {
    const goodbye = "Thank you for calling John Barclay Estate and Management. Have a wonderful day. Goodbye!";

    // Save call record
    this.saveCallRecord(call);

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy">${this.escapeXml(lastResponse)}</Say>
  <Pause length="1"/>
  <Say voice="Polly.Amy">${goodbye}</Say>
  <Hangup/>
</Response>`;
  }

  /**
   * Generate continue listening response
   */
  private generateContinueListening(callSid: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="/api/voice/process-speech" method="POST" speechTimeout="auto" language="en-GB">
    <Say voice="Polly.Amy">I'm still here. Please go ahead.</Say>
  </Gather>
  <Say voice="Polly.Amy">I'll let you go. Thank you for calling John Barclay. Goodbye!</Say>
  <Hangup/>
</Response>`;
  }

  /**
   * Generate error response
   */
  private generateErrorResponse(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy">I apologize, we're experiencing technical difficulties. Please call back or visit our website at johnbarclay.co.uk. Goodbye!</Say>
  <Hangup/>
</Response>`;
  }

  /**
   * Make outbound call
   */
  async makeOutboundCall(to: string, purpose: string, context: any): Promise<any> {
    try {
      const greeting = this.getOutboundGreeting(purpose, context);

      // Check if this is an existing lead
      const leadHistory = await voiceLeadService.findLeadByPhone(to);

      const call = await twilioClient.calls.create({
        to,
        from: TWILIO_PHONE_NUMBER || '',
        twiml: `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy">${this.escapeXml(greeting)}</Say>
  <Gather input="speech" action="${process.env.BASE_URL}/api/voice/process-speech" method="POST" speechTimeout="auto" language="en-GB">
  </Gather>
  <Say voice="Polly.Amy">I'll try again later. Goodbye!</Say>
  <Hangup/>
</Response>`,
        statusCallback: `${process.env.BASE_URL}/api/voice/status`,
        statusCallbackMethod: 'POST'
      });

      // Create call record in database
      const callRecordId = await voiceLeadService.saveCallRecord({
        callSid: call.sid,
        direction: 'outbound',
        callerPhone: to,
        agentPhone: TWILIO_PHONE_NUMBER || '',
        startedAt: new Date(),
        status: 'ringing',
        leadId: leadHistory?.lead.id
      });

      // Build system prompt with context
      let systemPrompt = this.SYSTEM_PROMPT;
      if (leadHistory) {
        const contextInfo = voiceLeadService.generateContextFromHistory(leadHistory);
        systemPrompt += `\n\n--- CALLER HISTORY ---\n${contextInfo}\n--- END HISTORY ---`;
      }

      // Create call record
      const activeCall: ActiveCall = {
        callSid: call.sid,
        from: TWILIO_PHONE_NUMBER!,
        to,
        direction: 'outbound',
        startTime: new Date(),
        status: 'ringing',
        conversationHistory: [
          { role: 'system', content: systemPrompt },
          { role: 'system', content: `This is an outbound call. Purpose: ${purpose}. Context: ${JSON.stringify(context)}` },
          { role: 'assistant', content: greeting }
        ],
        context: { purpose, ...context },
        transcript: [`Agent: ${greeting}`],
        leadId: leadHistory?.lead.id,
        isReturningCaller: !!leadHistory,
        leadHistory,
        callRecordId,
        propertiesDiscussed: context.propertyIds || []
      };

      this.activeCalls.set(call.sid, activeCall);

      return {
        success: true,
        callSid: call.sid,
        status: call.status,
        leadId: leadHistory?.lead.id
      };
    } catch (error: any) {
      console.error('Error making outbound call:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get outbound call greeting based on purpose
   */
  private getOutboundGreeting(purpose: string, context: any): string {
    const greetings: { [key: string]: string } = {
      'viewing_reminder': `Hello, this is Sarah from John Barclay Estate Agency. I'm calling to confirm your viewing appointment tomorrow at ${context.time || 'the scheduled time'} for the property at ${context.address || 'the address we discussed'}. Is that still convenient for you?`,

      'valuation_follow_up': `Good morning, this is Sarah from John Barclay Estate Agency. I'm following up on the valuation we conducted at ${context.address || 'your property'} last week. Have you had a chance to consider our proposal?`,

      'new_property_alert': `Hello, this is Sarah from John Barclay Estate Agency. A fantastic new property has just come on the market that I think perfectly matches what you're looking for. It's a ${context.property?.bedrooms || 3} bedroom ${context.property?.type || 'property'} in ${context.property?.area || 'your preferred area'}. Would you like to hear more about it?`,

      'offer_update': `Hello, this is Sarah from John Barclay Estate Agency calling with an update on your property at ${context.address || 'your property'}. We've received ${context.offerCount || 'an'} offer that I'd like to discuss with you. Do you have a moment?`,

      'general': `Hello, this is Sarah from John Barclay Estate Agency. How are you today?`
    };

    return greetings[purpose] || greetings['general'];
  }

  /**
   * Handle call status update
   */
  async handleCallStatus(statusData: any): Promise<void> {
    const callSid = statusData.CallSid;
    const status = statusData.CallStatus;

    const call = this.activeCalls.get(callSid);
    if (call) {
      call.status = status;

      if (['completed', 'failed', 'busy', 'no-answer'].includes(status)) {
        await this.saveCallRecord(call);
        this.activeCalls.delete(callSid);
      }
    }
  }

  /**
   * Save call record to database
   */
  private async saveCallRecord(call: ActiveCall): Promise<void> {
    try {
      const transcript = call.transcript.join('\n');
      const duration = Math.floor((new Date().getTime() - call.startTime.getTime()) / 1000);

      // Analyze transcript with AI using the voice lead service
      const analysis = await voiceLeadService.analyzeCallTranscript(transcript, call.propertiesDiscussed);

      // Determine lead ID - create new lead if this is a new caller
      let leadId = call.leadId;
      if (!leadId) {
        // Create a new lead from the call
        leadId = await voiceLeadService.createLeadFromCall(
          call.direction === 'inbound' ? call.from : call.to,
          {
            name: analysis.extractedInfo.name || call.context.customerName,
            email: analysis.extractedInfo.email || call.context.customerEmail,
            budgetMin: analysis.extractedInfo.budgetMin,
            budgetMax: analysis.extractedInfo.budgetMax,
            bedrooms: analysis.extractedInfo.bedrooms,
            areas: analysis.extractedInfo.areas,
            propertyType: analysis.extractedInfo.propertyType,
            leadType: analysis.intent.includes('rent') ? 'rental' : analysis.intent.includes('buy') ? 'purchase' : 'rental'
          }
        );
        call.leadId = leadId;
      } else {
        // Update existing lead with any new information
        await voiceLeadService.updateLeadFromCall(leadId, {
          name: analysis.extractedInfo.name,
          email: analysis.extractedInfo.email,
          budgetMin: analysis.extractedInfo.budgetMin,
          budgetMax: analysis.extractedInfo.budgetMax,
          bedrooms: analysis.extractedInfo.bedrooms,
          areas: analysis.extractedInfo.areas,
          propertyType: analysis.extractedInfo.propertyType
        });
      }

      // Update the call record with analysis results
      await voiceLeadService.updateCallWithAnalysis(call.callSid, analysis, leadId);

      // Update call record with final status
      await db.update(voiceCallRecords)
        .set({
          status: call.status === 'in-progress' ? 'completed' : call.status,
          endedAt: new Date(),
          duration,
          transcript,
          transcriptJson: call.transcript.map((line, idx) => ({
            index: idx,
            speaker: line.startsWith('Agent:') ? 'agent' : 'customer',
            text: line.replace(/^(Agent|Customer): /, ''),
            timestamp: call.startTime.getTime() + (idx * 5000) // Approximate timestamps
          })),
          propertiesDiscussed: call.propertiesDiscussed,
          updatedAt: new Date()
        })
        .where(eq(voiceCallRecords.callSid, call.callSid));

      // Record property interests
      for (const propertyId of call.propertiesDiscussed) {
        const interestLevel = analysis.propertiesInterestedIn.includes(propertyId) ? 'high'
          : analysis.propertiesRejected.includes(propertyId) ? 'rejected' : 'medium';

        await voiceLeadService.recordPropertyInterest(
          leadId,
          propertyId,
          call.callRecordId!,
          interestLevel
        );
      }

      // Send information if requested
      if (call.infoRequestedVia && call.propertiesDiscussed.length > 0) {
        const leadName = analysis.extractedInfo.name || call.context.customerName || 'there';
        const email = analysis.extractedInfo.email || call.context.customerEmail;
        const phone = call.direction === 'inbound' ? call.from : call.to;

        let sentVia: 'email' | 'whatsapp' | 'both' | undefined;

        if (call.infoRequestedVia === 'email' || call.infoRequestedVia === 'both') {
          if (email) {
            const emailSent = await voiceLeadService.sendInfoViaEmail(email, leadName, call.propertiesDiscussed);
            if (emailSent) {
              sentVia = 'email';
            }
          }
        }

        if (call.infoRequestedVia === 'whatsapp' || call.infoRequestedVia === 'both') {
          const whatsappSent = await voiceLeadService.sendInfoViaWhatsApp(phone, leadName, call.propertiesDiscussed);
          if (whatsappSent) {
            sentVia = sentVia === 'email' ? 'both' : 'whatsapp';
          }
        }

        if (sentVia) {
          await voiceLeadService.markInfoSent(
            call.callRecordId!,
            leadId,
            call.propertiesDiscussed,
            sentVia
          );
        }
      }

      // Also save to customer enquiries for legacy compatibility
      if (call.context.customerName || call.context.bookingIntent) {
        await db.insert(customerEnquiries).values({
          source: 'phone',
          sourceDetails: `AI Voice Agent - ${call.direction}`,
          customerName: call.context.customerName || 'Phone Caller',
          customerEmail: call.context.customerEmail || '',
          customerPhone: call.direction === 'inbound' ? call.from : call.to,
          enquiryType: call.context.valuationIntent ? 'valuation' : 'buying',
          message: `Call transcript:\n${transcript}\n\nAI Analysis: ${analysis.summary}`,
          status: 'new',
          leadScore: analysis.leadScore,
          leadTemperature: analysis.urgency === 'immediate' ? 'hot' : analysis.urgency === 'within_week' ? 'warm' : 'cold',
          autoResponseSent: !!call.infoRequestedVia
        });
      }

      // Send staff notifications for landlord/maintenance enquiries
      if (call.context.callbackRequired) {
        await this.notifyStaffOfCallback(call, analysis, leadId);
      }

      console.log(`Call record saved for ${call.callSid}, Lead ID: ${leadId}`);
    } catch (error) {
      console.error('Error saving call record:', error);
    }
  }

  /**
   * Notify staff of required callback via WhatsApp and email
   */
  private async notifyStaffOfCallback(call: ActiveCall, analysis: any, leadId: number): Promise<void> {
    try {
      const callerPhone = call.direction === 'inbound' ? call.from : call.to;
      const callerName = analysis.extractedInfo.name || call.context.customerName || 'Caller';
      const callerEmail = analysis.extractedInfo.email || call.context.customerEmail || 'Not provided';

      // Determine the right staff to notify based on department
      let staffWhatsApp: string | undefined;
      let staffEmail: string | undefined;
      let department = 'General';
      let urgencyEmoji = '📞';

      if (call.context.callbackDepartment === 'property_management') {
        department = 'Property Management';
        urgencyEmoji = '🏠';
        // These could be configured in env or database
        staffWhatsApp = process.env.PM_STAFF_WHATSAPP || process.env.TWILIO_PHONE_NUMBER;
        staffEmail = process.env.PM_STAFF_EMAIL || 'lettings@johnbarclay.co.uk';
      } else if (call.context.callbackDepartment === 'maintenance') {
        department = call.context.isEmergency ? 'EMERGENCY Maintenance' : 'Maintenance';
        urgencyEmoji = call.context.isEmergency ? '🚨' : '🔧';
        staffWhatsApp = process.env.MAINTENANCE_STAFF_WHATSAPP || process.env.TWILIO_PHONE_NUMBER;
        staffEmail = process.env.MAINTENANCE_STAFF_EMAIL || 'maintenance@johnbarclay.co.uk';
      }

      // Build notification message
      let message = `${urgencyEmoji} *${department} Callback Required*\n\n`;
      message += `📱 *Caller:* ${callerName}\n`;
      message += `☎️ *Phone:* ${callerPhone}\n`;
      message += `📧 *Email:* ${callerEmail}\n`;
      message += `⏰ *Call Time:* ${call.startTime.toLocaleString('en-GB')}\n`;
      message += `📊 *Priority:* ${call.context.callbackPriority?.toUpperCase() || 'NORMAL'}\n\n`;

      // Add landlord property details if available
      if (call.context.landlordPropertyDetails) {
        const details = call.context.landlordPropertyDetails;
        message += `🏠 *Property Details:*\n`;
        if (details.postcode) message += `• Postcode: ${details.postcode}\n`;
        if (details.propertyType) message += `• Type: ${details.propertyType}\n`;
        if (details.bedrooms) message += `• Bedrooms: ${details.bedrooms}\n`;
        if (details.bathrooms) message += `• Bathrooms: ${details.bathrooms}\n`;
        if (details.furnished) message += `• Furnished: ${details.furnished.replace('_', ' ')}\n`;
        if (details.expectedRent) message += `• Expected Rent: £${details.expectedRent.toLocaleString()}/month\n`;
        if (details.serviceType) message += `• Service: ${details.serviceType === 'full_management' ? 'Full Management' : 'Tenant Find Only'}\n`;
        if (details.availableNow) message += `• Available: Now\n`;
        if (details.isVacant) message += `• Status: Vacant\n`;
        if (details.currentlyTenanted) message += `• Status: Currently tenanted\n`;
        message += '\n';
      }

      // Add call summary
      message += `📝 *Call Summary:*\n${analysis.summary || 'No summary available'}\n\n`;

      // Add action required
      message += `✅ *Action Required:* Call back ${callerName} at ${callerPhone}`;
      if (call.context.callbackPriority === 'emergency') {
        message += ' IMMEDIATELY';
      } else if (call.context.callbackPriority === 'high') {
        message += ' within 2 hours';
      } else {
        message += ' within 24 hours';
      }

      // Send WhatsApp notification to staff
      if (twilioClient && staffWhatsApp) {
        try {
          await twilioClient.messages.create({
            from: process.env.TWILIO_WHATSAPP_NUMBER,
            to: `whatsapp:${staffWhatsApp}`,
            body: message
          });
          console.log(`WhatsApp notification sent to ${staffWhatsApp} for ${department}`);
        } catch (error) {
          console.error('Error sending WhatsApp notification to staff:', error);
        }
      }

      // Send email notification to staff
      if (staffEmail) {
        try {
          const nodemailer = await import('nodemailer');
          const transporter = nodemailer.default.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASSWORD
            }
          });

          const emailSubject = call.context.isEmergency
            ? `🚨 EMERGENCY: ${department} Callback Required - ${callerName}`
            : `${urgencyEmoji} ${department} Callback Required - ${callerName}`;

          // Build HTML email
          let emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: ${call.context.isEmergency ? '#dc2626' : '#2563eb'};">
                ${department} Callback Required
              </h2>

              <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                <h3 style="margin-top: 0;">Caller Details</h3>
                <p><strong>Name:</strong> ${callerName}</p>
                <p><strong>Phone:</strong> <a href="tel:${callerPhone}">${callerPhone}</a></p>
                <p><strong>Email:</strong> ${callerEmail !== 'Not provided' ? `<a href="mailto:${callerEmail}">${callerEmail}</a>` : callerEmail}</p>
                <p><strong>Call Time:</strong> ${call.startTime.toLocaleString('en-GB')}</p>
                <p><strong>Priority:</strong> <span style="color: ${call.context.callbackPriority === 'emergency' ? '#dc2626' : call.context.callbackPriority === 'high' ? '#ea580c' : '#16a34a'}; font-weight: bold;">${(call.context.callbackPriority || 'normal').toUpperCase()}</span></p>
              </div>
          `;

          // Add property details for landlords
          if (call.context.landlordPropertyDetails) {
            const d = call.context.landlordPropertyDetails;
            emailHtml += `
              <div style="background: #fef3c7; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                <h3 style="margin-top: 0;">Property Details</h3>
                ${d.postcode ? `<p><strong>Postcode:</strong> ${d.postcode}</p>` : ''}
                ${d.propertyType ? `<p><strong>Type:</strong> ${d.propertyType}</p>` : ''}
                ${d.bedrooms ? `<p><strong>Bedrooms:</strong> ${d.bedrooms}</p>` : ''}
                ${d.bathrooms ? `<p><strong>Bathrooms:</strong> ${d.bathrooms}</p>` : ''}
                ${d.furnished ? `<p><strong>Furnished:</strong> ${d.furnished.replace('_', ' ')}</p>` : ''}
                ${d.expectedRent ? `<p><strong>Expected Rent:</strong> £${d.expectedRent.toLocaleString()}/month</p>` : ''}
                ${d.serviceType ? `<p><strong>Service Requested:</strong> ${d.serviceType === 'full_management' ? 'Full Management' : 'Tenant Find Only'}</p>` : ''}
              </div>
            `;
          }

          // Add call summary
          emailHtml += `
              <div style="background: #e0f2fe; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                <h3 style="margin-top: 0;">Call Summary</h3>
                <p>${analysis.summary || 'No summary available'}</p>
              </div>

              <div style="background: ${call.context.isEmergency ? '#fef2f2' : '#f0fdf4'}; padding: 16px; border-radius: 8px; border: 2px solid ${call.context.isEmergency ? '#dc2626' : '#16a34a'};">
                <h3 style="margin-top: 0; color: ${call.context.isEmergency ? '#dc2626' : '#16a34a'};">Action Required</h3>
                <p style="font-size: 16px;">
                  Please call back <strong>${callerName}</strong> at
                  <a href="tel:${callerPhone}" style="color: #2563eb; font-weight: bold;">${callerPhone}</a>
                  ${call.context.callbackPriority === 'emergency' ? '<strong style="color: #dc2626;">IMMEDIATELY</strong>' :
                    call.context.callbackPriority === 'high' ? 'within <strong>2 hours</strong>' : 'within <strong>24 hours</strong>'}
                </p>
              </div>

              <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 12px;">
                This notification was generated by the John Barclay AI Receptionist.<br>
                Lead ID: ${leadId} | Call SID: ${call.callSid}
              </p>
            </div>
          `;

          await transporter.sendMail({
            from: `"John Barclay AI Receptionist" <${process.env.SMTP_FROM || 'noreply@johnbarclay.co.uk'}>`,
            to: staffEmail,
            subject: emailSubject,
            html: emailHtml
          });

          console.log(`Email notification sent to ${staffEmail} for ${department}`);
        } catch (error) {
          console.error('Error sending email notification to staff:', error);
        }
      }

    } catch (error) {
      console.error('Error notifying staff of callback:', error);
    }
  }

  /**
   * Analyze call transcript
   */
  private async analyzeCallTranscript(transcript: string): Promise<any> {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Analyze this estate agency call transcript and return a JSON object with: summary (2 sentences), sentiment (positive/neutral/negative), urgency (high/medium/low), actionItems (array of strings), and requirements (object with property requirements mentioned).'
          },
          { role: 'user', content: transcript }
        ],
        response_format: { type: 'json_object' }
      });

      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (error) {
      console.error('Error analyzing transcript:', error);
      return null;
    }
  }

  /**
   * Process user speech (for WebSocket streaming)
   */
  private async processUserSpeech(callSid: string, speech: string): Promise<string | null> {
    const call = this.activeCalls.get(callSid);
    if (!call) return null;

    call.conversationHistory.push({ role: 'user', content: speech });
    call.transcript.push(`Customer: ${speech}`);

    const response = await this.generateAIResponse(call);

    call.conversationHistory.push({ role: 'assistant', content: response });
    call.transcript.push(`Agent: ${response}`);

    return response;
  }

  /**
   * Get call analytics
   */
  async getCallAnalytics(period: string = 'week'): Promise<any> {
    // In production, query from stored call records
    return {
      period,
      totalCalls: 147,
      inboundCalls: 89,
      outboundCalls: 58,
      averageDuration: 4.5,
      conversionRate: 32,
      callsByPurpose: {
        'property_enquiry': 45,
        'viewing_booking': 38,
        'valuation_request': 21,
        'offer_discussion': 15,
        'general_enquiry': 28
      },
      sentiment: {
        positive: 78,
        neutral: 52,
        negative: 17
      },
      peakHours: [
        { hour: 10, calls: 18 },
        { hour: 11, calls: 22 },
        { hour: 14, calls: 19 },
        { hour: 15, calls: 21 },
        { hour: 16, calls: 17 }
      ]
    };
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

// Export singleton instance
export const aiPhone = new AIPhoneService();
