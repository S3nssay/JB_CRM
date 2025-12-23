import { db } from './db';
import { 
  properties, 
  viewingAppointments,
  propertyWorkflows,
  customerEnquiries,
  users
} from '@shared/schema';
import { eq, and, gte, lte, like, or, sql } from 'drizzle-orm';
import { openaiClient, isOpenAIConfigured } from './lib/openaiClient';

const openai = openaiClient;

// Retell AI configuration
interface RetellConfig {
  apiKey: string;
  agentId: string;
  webhookUrl: string;
}

// Voice call tracking
interface VoiceCall {
  id: string;
  callSid: string;
  from: string;
  to: string;
  direction: 'inbound' | 'outbound';
  status: 'ringing' | 'in-progress' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  transcript?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  summary?: string;
  actionItems?: string[];
  propertyId?: number;
  customerId?: number;
}

export class VoiceAgentService {
  private retellConfig: RetellConfig;
  private twilioConfig: any;
  
  constructor() {
    this.retellConfig = {
      apiKey: process.env.RETELL_API_KEY || 'demo_key',
      agentId: process.env.RETELL_AGENT_ID || 'demo_agent',
      webhookUrl: process.env.RETELL_WEBHOOK_URL || 'https://api.retellai.com'
    };
    
    this.twilioConfig = {
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      phoneNumber: process.env.TWILIO_PHONE_NUMBER
    };
  }
  
  // Initialize Retell AI agent with property knowledge base
  async initializeVoiceAgent() {
    try {
      // Configure Retell AI agent with custom instructions
      const agentConfig = {
        name: "John Barclay Estate Agent",
        voice: "professional-british-female",
        language: "en-GB",
        temperature: 0.7,
        
        systemPrompt: `You are Sarah, a professional estate agent at John Barclay Estate & Management. 
        You handle property enquiries for West London areas including W9, W10, W11, NW6, and NW10.
        
        Your responsibilities:
        1. Answer property queries professionally and warmly
        2. Provide property details including price, bedrooms, location, features
        3. Book viewings and valuations
        4. Qualify leads by asking about budget, timeline, and requirements
        5. Capture contact details for follow-up
        
        Key information:
        - Office hours: 9am-6pm Monday-Saturday
        - Emergency maintenance: Available 24/7
        - Viewing slots: Every 30 minutes during office hours
        - Valuation appointments: 1-hour slots, free service
        
        Always be helpful, professional, and aim to book appointments when appropriate.
        If unsure about specific property details, offer to have a specialist call back.`,
        
        // Knowledge base configuration
        knowledgeBase: {
          type: "dynamic",
          endpoint: `${process.env.BASE_URL}/api/voice/knowledge`,
          cacheTime: 300 // 5 minutes
        },
        
        // Function calling for CRM integration
        functions: [
          {
            name: "search_properties",
            description: "Search for available properties",
            parameters: {
              type: "object",
              properties: {
                area: { type: "string", description: "Area or postcode" },
                minBedrooms: { type: "number" },
                maxPrice: { type: "number" },
                propertyType: { type: "string", enum: ["flat", "house", "commercial"] }
              }
            }
          },
          {
            name: "book_viewing",
            description: "Book a property viewing",
            parameters: {
              type: "object",
              properties: {
                propertyId: { type: "string" },
                customerName: { type: "string" },
                customerEmail: { type: "string" },
                customerPhone: { type: "string" },
                preferredDate: { type: "string", format: "date" },
                preferredTime: { type: "string" }
              },
              required: ["propertyId", "customerName", "customerPhone", "preferredDate"]
            }
          },
          {
            name: "book_valuation",
            description: "Book a property valuation",
            parameters: {
              type: "object",
              properties: {
                propertyAddress: { type: "string" },
                ownerName: { type: "string" },
                ownerEmail: { type: "string" },
                ownerPhone: { type: "string" },
                preferredDate: { type: "string", format: "date" },
                propertyType: { type: "string" },
                reason: { type: "string", enum: ["selling", "remortgage", "probate", "curiosity"] }
              },
              required: ["propertyAddress", "ownerName", "ownerPhone"]
            }
          },
          {
            name: "create_enquiry",
            description: "Create a customer enquiry for follow-up",
            parameters: {
              type: "object",
              properties: {
                customerName: { type: "string" },
                customerEmail: { type: "string" },
                customerPhone: { type: "string" },
                enquiryType: { type: "string", enum: ["buying", "selling", "renting", "letting"] },
                budget: { type: "string" },
                requirements: { type: "object" },
                notes: { type: "string" }
              },
              required: ["customerName", "customerPhone", "enquiryType"]
            }
          }
        ],
        
        // Call handling settings
        callSettings: {
          maxDuration: 900, // 15 minutes max
          voicemailDetection: true,
          backgroundNoiseSupression: true,
          interruptionThreshold: 200, // ms
          endCallPhrases: ["goodbye", "bye", "thank you goodbye"],
          transferPhrases: ["speak to human", "real person", "transfer me"],
          
          // Compliance settings
          recordingConsent: true,
          consentScript: "This call may be recorded for quality and training purposes. Is that okay?",
          gdprCompliant: true
        }
      };
      
      // Initialize agent with Retell AI
      console.log('Initializing Retell AI voice agent:', agentConfig);
      
      return {
        success: true,
        agentId: this.retellConfig.agentId,
        config: agentConfig
      };
    } catch (error) {
      console.error('Error initializing voice agent:', error);
      throw error;
    }
  }
  
  // Handle inbound calls via Twilio webhook
  async handleInboundCall(callData: any) {
    try {
      console.log('Handling inbound call:', callData);
      
      // Create call record
      const call: VoiceCall = {
        id: `call_${Date.now()}`,
        callSid: callData.CallSid,
        from: callData.From,
        to: callData.To,
        direction: 'inbound',
        status: 'ringing',
        startTime: new Date()
      };
      
      // Connect to Retell AI agent
      const retellResponse = await this.connectToRetellAgent(call);
      
      // Return TwiML response to connect call
      return `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say voice="Polly.Amy">Hello, thank you for calling John Barclay Estate and Management. Connecting you to our property specialist.</Say>
          <Redirect>${retellResponse.webhookUrl}</Redirect>
        </Response>`;
    } catch (error) {
      console.error('Error handling inbound call:', error);
      
      // Fallback response
      return `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say>We're experiencing technical difficulties. Please call back later or press 1 to leave a voicemail.</Say>
          <Gather numDigits="1">
            <Say>Press 1 to leave a voicemail.</Say>
          </Gather>
        </Response>`;
    }
  }
  
  // Make outbound call
  async makeOutboundCall(phoneNumber: string, purpose: string, context: any) {
    try {
      console.log(`Making outbound call to ${phoneNumber} for ${purpose}`);
      
      // Prepare agent context based on purpose
      const agentContext = this.prepareOutboundContext(purpose, context);
      
      // Initialize outbound call with Retell
      const retellCall = await this.initializeRetellCall({
        to: phoneNumber,
        agentId: this.retellConfig.agentId,
        context: agentContext,
        metadata: {
          purpose,
          propertyId: context.propertyId,
          customerId: context.customerId
        }
      });
      
      // Trigger call via Twilio
      const twilioCall = await this.triggerTwilioCall(phoneNumber, retellCall.webhookUrl);
      
      return {
        success: true,
        callId: retellCall.callId,
        twilioSid: twilioCall.sid,
        status: 'initiated'
      };
    } catch (error) {
      console.error('Error making outbound call:', error);
      throw error;
    }
  }
  
  // Handle function calls from voice agent
  async handleAgentFunction(functionName: string, parameters: any, callId: string) {
    try {
      console.log(`Handling agent function: ${functionName}`, parameters);
      
      switch (functionName) {
        case 'search_properties':
          return await this.searchPropertiesForVoice(parameters);
          
        case 'book_viewing':
          return await this.bookViewingFromVoice(parameters);
          
        case 'book_valuation':
          return await this.bookValuationFromVoice(parameters);
          
        case 'create_enquiry':
          return await this.createEnquiryFromVoice(parameters);
          
        default:
          return { error: 'Unknown function' };
      }
    } catch (error) {
      console.error(`Error handling function ${functionName}:`, error);
      return { error: error.message };
    }
  }
  
  // Search properties for voice response
  private async searchPropertiesForVoice(params: any) {
    try {
      // Build query
      let query = db.select().from(properties).where(eq(properties.status, 'available'));
      
      // Add filters
      if (params.area) {
        query = query.where(
          or(
            like(properties.postcode, `%${params.area}%`),
            like(properties.addressLine1, `%${params.area}%`)
          )
        );
      }
      
      if (params.minBedrooms) {
        query = query.where(gte(properties.bedrooms, params.minBedrooms));
      }
      
      if (params.maxPrice) {
        query = query.where(lte(properties.price, params.maxPrice * 100)); // Convert to pence
      }
      
      const results = await query.limit(3); // Limit for voice readability
      
      // Format for voice response
      const formattedResults = results.map(p => ({
        id: p.id,
        address: `${p.addressLine1}, ${p.postcode}`,
        price: `£${(p.price / 100).toLocaleString()}`,
        bedrooms: p.bedrooms,
        propertyType: p.propertyType,
        keyFeatures: p.features?.slice(0, 3).join(', ')
      }));
      
      return {
        success: true,
        count: formattedResults.length,
        properties: formattedResults,
        voiceResponse: this.generatePropertyVoiceResponse(formattedResults)
      };
    } catch (error) {
      console.error('Error searching properties for voice:', error);
      return {
        success: false,
        voiceResponse: "I'm having trouble searching for properties right now. Let me take your details and have someone call you back."
      };
    }
  }
  
  // Book viewing from voice call
  private async bookViewingFromVoice(params: any) {
    try {
      // Check property availability
      const [property] = await db.select()
        .from(properties)
        .where(eq(properties.id, parseInt(params.propertyId)));
      
      if (!property) {
        return {
          success: false,
          voiceResponse: "I couldn't find that property. Could you please confirm the property reference?"
        };
      }
      
      // Create viewing appointment
      const [appointment] = await db.insert(viewingAppointments).values({
        propertyId: property.id,
        viewerName: params.customerName,
        viewerEmail: params.customerEmail || '',
        viewerPhone: params.customerPhone,
        scheduledDate: new Date(`${params.preferredDate} ${params.preferredTime || '14:00'}`),
        status: 'scheduled',
        appointmentType: 'in_person'
      }).returning();
      
      return {
        success: true,
        appointmentId: appointment.id,
        voiceResponse: `Perfect! I've booked your viewing for ${property.addressLine1} on ${params.preferredDate} at ${params.preferredTime || '2pm'}. You'll receive a confirmation text shortly. Is there anything else I can help you with?`
      };
    } catch (error) {
      console.error('Error booking viewing from voice:', error);
      return {
        success: false,
        voiceResponse: "I'm having trouble booking that viewing. Let me take your details and have someone call you back to confirm."
      };
    }
  }
  
  // Book valuation from voice call
  private async bookValuationFromVoice(params: any) {
    try {
      // Create valuation request in workflow
      const [workflow] = await db.insert(propertyWorkflows).values({
        currentStage: 'valuation_requested',
        valuationRequestDate: new Date(),
        vendorId: 0, // Will be linked later
        valuationDate: new Date(`${params.preferredDate} 10:00`),
        valuationNotes: `Reason: ${params.reason || 'Not specified'}. Property type: ${params.propertyType}`
      }).returning();
      
      // Create customer enquiry for follow-up
      await db.insert(customerEnquiries).values({
        source: 'phone',
        sourceDetails: 'AI Voice Agent',
        customerName: params.ownerName,
        customerEmail: params.ownerEmail || '',
        customerPhone: params.ownerPhone,
        enquiryType: 'valuation',
        message: `Valuation requested for ${params.propertyAddress}`,
        status: 'new',
        leadScore: 85,
        leadTemperature: 'hot'
      });
      
      return {
        success: true,
        valuationId: workflow.id,
        voiceResponse: `Excellent! I've scheduled your free valuation for ${params.propertyAddress} on ${params.preferredDate}. One of our senior valuers will visit between 10am and 11am. You'll receive a confirmation text with full details. The valuation typically takes about 45 minutes.`
      };
    } catch (error) {
      console.error('Error booking valuation from voice:', error);
      return {
        success: false,
        voiceResponse: "I'm having trouble scheduling that valuation. Let me take your details and have our valuation team call you back today."
      };
    }
  }
  
  // Create enquiry from voice call
  private async createEnquiryFromVoice(params: any) {
    try {
      const [enquiry] = await db.insert(customerEnquiries).values({
        source: 'phone',
        sourceDetails: 'AI Voice Agent',
        customerName: params.customerName,
        customerEmail: params.customerEmail || '',
        customerPhone: params.customerPhone,
        enquiryType: params.enquiryType,
        budget: params.budget,
        requirements: params.requirements || {},
        message: params.notes || '',
        status: 'new',
        leadScore: 70,
        leadTemperature: 'warm',
        autoResponseSent: true
      }).returning();
      
      return {
        success: true,
        enquiryId: enquiry.id,
        voiceResponse: "Thank you for your enquiry. I've noted all your requirements and one of our specialist agents will call you back within 2 hours with suitable properties. You'll also receive an email with our current property portfolio."
      };
    } catch (error) {
      console.error('Error creating enquiry from voice:', error);
      return {
        success: false,
        voiceResponse: "Let me make sure I have your contact details correct so our team can follow up with you."
      };
    }
  }
  
  // Generate natural voice response for properties
  private generatePropertyVoiceResponse(properties: any[]): string {
    if (properties.length === 0) {
      return "I couldn't find any properties matching your criteria. However, we have new properties coming in daily. Would you like me to register your requirements so we can notify you immediately when something suitable becomes available?";
    }
    
    let response = `I found ${properties.length} ${properties.length === 1 ? 'property' : 'properties'} that ${properties.length === 1 ? 'matches' : 'match'} your requirements. `;
    
    properties.forEach((p, index) => {
      response += `${index === 0 ? 'The first' : index === 1 ? 'The second' : 'The third'} is a ${p.bedrooms} bedroom ${p.propertyType} in ${p.address.split(',')[1]?.trim() || p.address} for ${p.price}${p.keyFeatures ? `, featuring ${p.keyFeatures}` : ''}. `;
    });
    
    response += "Would you like to book a viewing for any of these properties?";
    
    return response;
  }
  
  // Prepare context for outbound calls
  private prepareOutboundContext(purpose: string, context: any): any {
    const contexts: { [key: string]: any } = {
      'viewing_reminder': {
        opening: `Hello, this is Sarah from John Barclay Estate Agency. I'm calling to confirm your viewing appointment tomorrow at ${context.time} for the property at ${context.address}.`,
        objective: "Confirm viewing attendance and answer any questions",
        fallback: "If you need to reschedule, I can help arrange an alternative time."
      },
      
      'valuation_follow_up': {
        opening: `Good morning, this is Sarah from John Barclay Estate Agency. I'm following up on the valuation we conducted at ${context.address} last week.`,
        objective: "Discuss valuation results and secure instruction",
        fallback: "I can email you the full valuation report if you'd prefer to review it first."
      },
      
      'new_property_alert': {
        opening: `Hello, this is Sarah from John Barclay Estate Agency. A fantastic new property just came on the market that perfectly matches what you're looking for.`,
        objective: "Generate interest and book viewing",
        propertyDetails: context.property,
        fallback: "I can send you the full details and photos right now if you'd like."
      },
      
      'offer_negotiation': {
        opening: `Hello, this is Sarah from John Barclay Estate Agency. We've received an offer on your property at ${context.address}.`,
        objective: "Discuss offer and get decision",
        offerDetails: context.offer,
        fallback: "Would you prefer to discuss this in person at our office?"
      }
    };
    
    return contexts[purpose] || contexts['new_property_alert'];
  }
  
  // Connect to Retell AI agent
  private async connectToRetellAgent(call: VoiceCall) {
    // Mock Retell connection - in production, use actual Retell API
    return {
      webhookUrl: `${process.env.BASE_URL}/api/voice/retell-webhook`,
      agentId: this.retellConfig.agentId,
      sessionId: `session_${Date.now()}`
    };
  }
  
  // Initialize Retell call
  private async initializeRetellCall(params: any) {
    // Mock Retell initialization - in production, use actual Retell API
    return {
      callId: `retell_${Date.now()}`,
      webhookUrl: `${process.env.BASE_URL}/api/voice/retell-outbound`
    };
  }
  
  // Trigger Twilio call
  private async triggerTwilioCall(to: string, webhookUrl: string) {
    // Mock Twilio call - in production, use actual Twilio API
    return {
      sid: `twilio_${Date.now()}`,
      status: 'queued'
    };
  }
  
  // Process call transcript and extract insights
  async processCallTranscript(callId: string, transcript: string) {
    try {
      const prompt = `Analyze this estate agency call transcript and extract:
      1. Summary (2-3 sentences)
      2. Customer sentiment (positive/neutral/negative)
      3. Action items for follow-up
      4. Property requirements mentioned
      5. Urgency level (high/medium/low)
      
      Transcript: ${transcript}
      
      Return JSON format.`;
      
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      });
      
      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        summary: analysis.summary,
        sentiment: analysis.sentiment,
        actionItems: analysis.actionItems,
        requirements: analysis.requirements,
        urgency: analysis.urgency
      };
    } catch (error) {
      console.error('Error processing call transcript:', error);
      return null;
    }
  }
  
  // Get call analytics
  async getCallAnalytics(period: string = 'week') {
    // Mock analytics - in production, query actual call logs
    return {
      period,
      totalCalls: 147,
      inboundCalls: 89,
      outboundCalls: 58,
      averageDuration: 4.5, // minutes
      conversionRate: 32, // percentage
      
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
      ],
      
      topEnquiryAreas: [
        { area: 'W10', count: 31 },
        { area: 'W9', count: 28 },
        { area: 'NW6', count: 24 },
        { area: 'W11', count: 22 },
        { area: 'NW10', count: 19 }
      ]
    };
  }
}

export const voiceAgent = new VoiceAgentService();