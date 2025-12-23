import twilio from 'twilio';
import { db } from './db';
import {
  properties,
  viewingAppointments,
  propertyWorkflows,
  customerEnquiries,
  users
} from '@shared/schema';
import { eq, and, gte, lte, like, or, sql } from 'drizzle-orm';
import { WebSocketServer, WebSocket } from 'ws';
import { openaiClient, isOpenAIConfigured } from './lib/openaiClient';

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

Key information:
- Office hours: 9am-6pm Monday to Saturday
- Covered areas: W9, W10, W11, NW6, NW10 (Maida Vale, Queen's Park, Notting Hill, Kilburn)
- Viewing slots: Every 30 minutes during office hours
- Valuations: Free service, 45-minute appointments
- Emergency maintenance: Available 24/7 for tenants

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

    // Create call record
    const call: ActiveCall = {
      callSid,
      from,
      to,
      direction: 'inbound',
      startTime: new Date(),
      status: 'in-progress',
      conversationHistory: [
        { role: 'system', content: this.SYSTEM_PROMPT }
      ],
      context: {},
      transcript: []
    };

    this.activeCalls.set(callSid, call);

    // Generate TwiML response
    const greeting = "Hello, thank you for calling John Barclay Estate and Management. I'm Sarah, how can I help you today?";

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
    const propertyKeywords = ['property', 'flat', 'house', 'bedroom', 'rent', 'buy', 'sale', 'available'];
    const isPropertyQuery = propertyKeywords.some(keyword => userInput.includes(keyword));

    if (!isPropertyQuery) return null;

    try {
      // Extract potential criteria
      const bedroomMatch = userInput.match(/(\d+)\s*bed/);
      const bedrooms = bedroomMatch ? parseInt(bedroomMatch[1]) : undefined;

      const postcodeMatch = userInput.match(/\b(w9|w10|w11|nw6|nw10)\b/i);
      const postcode = postcodeMatch ? postcodeMatch[1].toUpperCase() : undefined;

      // Query properties with filters
      const conditions = [eq(properties.status, 'active')];

      if (bedrooms) {
        conditions.push(gte(properties.bedrooms, bedrooms));
      }

      if (postcode) {
        conditions.push(like(properties.postcode, `${postcode}%`));
      }

      const results = await db.select()
        .from(properties)
        .where(and(...conditions))
        .limit(3);

      if (results.length === 0) {
        return null;
      }

      // Format for context
      const propertyList = results.map(p => ({
        id: p.id,
        address: `${p.addressLine1}, ${p.postcode}`,
        price: `£${(p.price / 100).toLocaleString()}`,
        type: p.propertyType,
        bedrooms: p.bedrooms,
        features: p.features?.slice(0, 3).join(', ')
      }));

      call.context.matchedProperties = propertyList;

      return `Available properties matching the query:\n${propertyList.map(p =>
        `- ${p.bedrooms} bed ${p.type} at ${p.address} for ${p.price}${p.features ? ` (${p.features})` : ''}`
      ).join('\n')}\nMention these properties naturally in your response.`;

    } catch (error) {
      console.error('Error fetching property context:', error);
      return null;
    }
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

    // Check for contact capture
    if (this.detectContactInfo(input)) {
      await this.captureContactInfo(call, input);
    }
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

      // Create call record
      const activeCall: ActiveCall = {
        callSid: call.sid,
        from: TWILIO_PHONE_NUMBER!,
        to,
        direction: 'outbound',
        startTime: new Date(),
        status: 'ringing',
        conversationHistory: [
          { role: 'system', content: this.SYSTEM_PROMPT },
          { role: 'system', content: `This is an outbound call. Purpose: ${purpose}. Context: ${JSON.stringify(context)}` },
          { role: 'assistant', content: greeting }
        ],
        context: { purpose, ...context },
        transcript: [`Agent: ${greeting}`]
      };

      this.activeCalls.set(call.sid, activeCall);

      return {
        success: true,
        callSid: call.sid,
        status: call.status
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
      // Analyze transcript with AI
      const analysis = await this.analyzeCallTranscript(call.transcript.join('\n'));

      // Save to customer enquiries if we have context
      if (call.context.customerName || call.context.bookingIntent) {
        await db.insert(customerEnquiries).values({
          source: 'phone',
          sourceDetails: `AI Voice Agent - ${call.direction}`,
          customerName: call.context.customerName || 'Phone Caller',
          customerEmail: call.context.customerEmail || '',
          customerPhone: call.direction === 'inbound' ? call.from : call.to,
          enquiryType: call.context.valuationIntent ? 'valuation' : 'buying',
          message: `Call transcript:\n${call.transcript.join('\n')}\n\nAI Analysis: ${analysis?.summary || 'N/A'}`,
          status: 'new',
          leadScore: analysis?.urgency === 'high' ? 90 : analysis?.urgency === 'medium' ? 70 : 50,
          leadTemperature: analysis?.urgency === 'high' ? 'hot' : analysis?.urgency === 'medium' ? 'warm' : 'cold',
          autoResponseSent: false
        });
      }

      console.log(`Call record saved for ${call.callSid}`);
    } catch (error) {
      console.error('Error saving call record:', error);
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
