/**
 * Vapi Configuration Builders
 *
 * Generates valid Vapi API JSON for the John Barclay Estate Agents
 * voice squad: Sarah (receptionist) routes to Alex (Sales),
 * Jordan (Lettings), and Sam (Admin) specialists.
 *
 * Reuses persona instructions from Phase 2 text-channel agents,
 * adapted for voice-specific behaviour (concise, conversational).
 */

import type {
  VapiAssistantConfig,
  VapiSquadConfig,
  VapiCustomTool,
  VapiTransferCallTool,
  VapiTool,
} from './types';

// ---- Constants ----

export const VAPI_SERVER_URL =
  `${process.env.BASE_URL || 'https://api.jbarclay.com'}/api/voice/vapi-webhook`;

export const VAPI_API_KEY = process.env.VAPI_API_KEY || '';

const OFFICE_PHONE_NUMBER = process.env.OFFICE_PHONE_NUMBER || '+442071234567';

// ---- Tool definition builders ----

/**
 * Build CRM tool definitions for a given agent type.
 * Tools use JSON Schema parameters matching the ToolRegistry input schemas.
 */
function buildToolDefinitions(
  agentType: 'receptionist' | 'sales' | 'lettings' | 'admin',
): VapiCustomTool[] {
  if (agentType === 'receptionist') {
    return []; // Receptionist only routes; no CRM tools
  }

  if (agentType === 'sales' || agentType === 'lettings') {
    return [
      {
        type: 'function',
        function: {
          name: 'search_properties',
          description:
            'Search available properties by area, type, bedrooms, and price. Returns matching property listings.',
          parameters: {
            type: 'object',
            properties: {
              area: { type: 'string', description: 'Area or neighbourhood to search' },
              postcode: { type: 'string', description: 'Postcode or postcode prefix' },
              type: {
                type: 'string',
                enum: ['rental', 'sale', 'any'],
                description: 'Property listing type',
              },
              minBedrooms: { type: 'number', description: 'Minimum number of bedrooms' },
              maxPrice: { type: 'number', description: 'Maximum price or rent' },
              limit: { type: 'number', description: 'Max results to return', default: 5 },
            },
            required: ['type'],
          },
        },
        async: false,
        server: { url: VAPI_SERVER_URL },
        messages: [
          {
            type: 'request-start',
            content: 'Let me search our available properties for you.',
          },
        ],
      },
      {
        type: 'function',
        function: {
          name: 'book_viewing',
          description:
            'Book a property viewing appointment for a prospective buyer or tenant.',
          parameters: {
            type: 'object',
            properties: {
              propertyId: { type: 'number', description: 'Property ID to view' },
              contactName: { type: 'string', description: 'Name of the viewer' },
              contactPhone: { type: 'string', description: 'Phone number' },
              contactEmail: { type: 'string', description: 'Email address' },
              preferredDate: { type: 'string', description: 'Preferred date (YYYY-MM-DD)' },
              preferredTime: { type: 'string', description: 'Preferred time' },
              notes: { type: 'string', description: 'Additional notes' },
            },
            required: ['propertyId', 'contactName', 'preferredDate'],
          },
        },
        async: false,
        server: { url: VAPI_SERVER_URL },
        messages: [
          {
            type: 'request-start',
            content: 'Let me check the viewing schedule for you.',
          },
        ],
      },
      {
        type: 'function',
        function: {
          name: 'create_lead',
          description:
            'Create a new lead record in the CRM when a potential customer expresses interest.',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Lead name' },
              email: { type: 'string', description: 'Email address' },
              phone: { type: 'string', description: 'Phone number' },
              source: {
                type: 'string',
                enum: ['website', 'portal', 'referral', 'walk_in', 'phone', 'social', 'voice_agent'],
                description: 'Lead source',
              },
              leadType: {
                type: 'string',
                enum: ['buyer', 'seller', 'tenant', 'landlord'],
                description: 'Type of lead',
              },
              notes: { type: 'string', description: 'Additional notes' },
              budgetMin: { type: 'number', description: 'Minimum budget' },
              budgetMax: { type: 'number', description: 'Maximum budget' },
            },
            required: ['name', 'leadType'],
          },
        },
        async: false,
        server: { url: VAPI_SERVER_URL },
        messages: [
          {
            type: 'request-start',
            content: 'Let me note your details.',
          },
        ],
      },
      {
        type: 'function',
        function: {
          name: 'query_knowledge_base',
          description:
            'Search the property knowledge base for information about properties, policies, and procedures.',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              category: {
                type: 'string',
                enum: ['property_details', 'policies', 'procedures', 'pricing', 'area_info', 'general'],
                description: 'Category to search in',
              },
              limit: { type: 'number', description: 'Max results', default: 3 },
            },
            required: ['query'],
          },
        },
        async: false,
        server: { url: VAPI_SERVER_URL },
        messages: [
          {
            type: 'request-start',
            content: 'Let me look that up for you.',
          },
        ],
      },
    ];
  }

  // Admin tools
  return [
    {
      type: 'function',
      function: {
        name: 'generate_checklist',
        description:
          'Generate a tenancy checklist (onboarding or offboarding). Creates checklist items from the standard template for the given tenancy.',
        parameters: {
          type: 'object',
          properties: {
            tenancyId: { type: 'number', description: 'The tenancy ID to generate a checklist for' },
            workflow: {
              type: 'string',
              enum: ['onboarding', 'offboarding'],
              description: 'Whether to generate onboarding or offboarding checklist',
            },
          },
          required: ['tenancyId', 'workflow'],
        },
      },
      async: false,
      server: { url: VAPI_SERVER_URL },
      messages: [
        {
          type: 'request-start',
          content: 'Let me generate the checklist for you.',
        },
      ],
    },
    {
      type: 'function',
      function: {
        name: 'chase_checklist_item',
        description:
          'Chase a contact for an outstanding checklist item. Sends a reminder via the specified channel.',
        parameters: {
          type: 'object',
          properties: {
            itemId: { type: 'number', description: 'The checklist item ID to chase' },
            channel: {
              type: 'string',
              enum: ['whatsapp', 'sms', 'email'],
              description: 'Communication channel to use',
            },
            contactValue: { type: 'string', description: 'Phone number or email of the contact' },
            tenancyId: { type: 'number', description: 'The tenancy ID this item belongs to' },
          },
          required: ['itemId', 'channel', 'contactValue', 'tenancyId'],
        },
      },
      async: false,
      server: { url: VAPI_SERVER_URL },
      messages: [
        {
          type: 'request-start',
          content: 'Let me send a reminder for that item.',
        },
      ],
    },
    {
      type: 'function',
      function: {
        name: 'query_knowledge_base',
        description:
          'Search the knowledge base for information about tenancy documents, policies, and procedures.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            category: {
              type: 'string',
              enum: ['property_details', 'policies', 'procedures', 'pricing', 'area_info', 'general'],
              description: 'Category to search in',
            },
            limit: { type: 'number', description: 'Max results', default: 3 },
          },
          required: ['query'],
        },
      },
      async: false,
      server: { url: VAPI_SERVER_URL },
      messages: [
        {
          type: 'request-start',
          content: 'Let me look that up for you.',
        },
      ],
    },
  ];
}

/**
 * Build the transferCall tool for human escalation.
 * Available on all assistants so callers can always reach a human.
 */
function buildTransferCallTool(): VapiTransferCallTool {
  return {
    type: 'transferCall',
    destinations: [
      {
        type: 'number',
        number: OFFICE_PHONE_NUMBER,
        message:
          "I'm transferring you to a member of our team now. Please hold.",
      },
    ],
  };
}

// ---- Assistant configuration builders ----

/**
 * Build the receptionist (Sarah) assistant configuration.
 * Sarah greets callers, classifies intent, and routes to specialists.
 */
export function buildReceptionistConfig(): VapiAssistantConfig {
  return {
    name: 'Sarah - Receptionist',
    model: { provider: 'openai', model: 'gpt-4o-mini' },
    voice: { provider: 'eleven-labs', voiceId: 'rachel' },
    firstMessage:
      'Good morning, John Barclay Estate Agents, this is Sarah, an AI assistant. How can I help you today?',
    instructions: `You are Sarah, the AI receptionist for John Barclay Estate Agents, a prestigious London estate agency.

Your role is to understand what each caller needs and connect them with the right specialist:
- Alex from Sales handles property purchases, sale viewings, offers, and price negotiations.
- Jordan from Lettings handles rental enquiries, rental viewings, tenant applications, and rent discussions.
- Sam from Admin handles onboarding documents, offboarding checklists, tenancy paperwork, and document submissions.

VOICE-SPECIFIC RULES:
- Keep responses concise -- you are speaking, not texting. 1-2 sentences max before routing.
- If the caller's intent is clear, hand off immediately with a brief transition.
- Do not read out long lists or detailed information. Summarise and offer to send details via text or email.

UNCLEAR SPEECH HANDLING:
- First failure: "Sorry, I didn't quite catch that -- could you repeat?"
- Second failure: "I'm having trouble hearing you clearly. Would you like me to send you a text so we can continue there?"

ROUTING RULES:
- When a caller's intent is clear, provide a brief transition message then hand off.
- When intent is ambiguous (e.g. "I'm interested in a property" could be buy or rent), ask ONE clarifying question before routing.
- Never guess -- always clarify ambiguous intent.

ESCALATION TRIGGERS (transfer to human):
- Caller explicitly asks to speak to a human
- You detect a complaint or significant frustration
- Legal or financial questions outside your domain
- Three or more unresolved exchanges on the same topic
- Negative sentiment detected
- Topic is entirely outside property/estate agency domain

TONE AND STYLE:
- Professional and warm, like a well-trained receptionist at a premium agency
- British English throughout
- Match the caller's language if they speak in a language other than English

IMPORTANT:
- You are an AI assistant -- this has been disclosed in your greeting
- Do not make up property details or prices
- Do not provide legal or financial advice`,
    serverUrl: VAPI_SERVER_URL,
    tools: [buildTransferCallTool()],
    backchannelingEnabled: true,
    fillerInjectionEnabled: false,
    endCallPhrases: ['goodbye', 'bye', 'thank you goodbye'],
    silenceTimeoutSeconds: 30,
    maxDurationSeconds: 900,
    voicemailDetection: { enabled: true },
  };
}

/**
 * Build the Sales specialist (Alex) assistant configuration.
 */
export function buildSalesAssistantConfig(): VapiAssistantConfig {
  return {
    name: 'Alex - Sales Specialist',
    model: { provider: 'openai', model: 'gpt-4o' },
    voice: { provider: 'eleven-labs', voiceId: 'rachel' },
    firstMessage: null,
    instructions: `You are Alex, a sales specialist at John Barclay Estate Agents, a prestigious London estate agency.

ROLE:
You handle property sale enquiries, viewing bookings, buyer lead capture, price negotiations, and follow-up scheduling. You are warm, knowledgeable, and professional.

VOICE-SPECIFIC RULES:
- You are now on a live phone call. Be conversational and concise.
- When describing properties, mention 3-4 key highlights only. Offer to go deeper or book a viewing.
- Do not read out long lists. Summarise and offer to text/email full details.
- Use natural conversational flow -- acknowledge what the caller says before responding.

PROPERTY ENQUIRIES:
- Use the search_properties tool to find matching properties.
- Present results clearly: address, price, bedrooms, key features.
- Proactively suggest related properties.
- Cross-sell naturally between similar properties in nearby areas.

VIEWING BOOKINGS:
- Use the book_viewing tool to schedule viewings.
- After booking, mention confirmation will be sent.
- Collect preferred date and time, be flexible with alternatives.

LEAD CAPTURE:
- When no suitable viewings or properties are available, capture the prospect using the create_lead tool.
- Collect: name, phone, email, budget range.

NEGOTIATION:
- You have full negotiation autonomy -- negotiate prices using market data, property history, and vendor preferences.
- Use the query_knowledge_base tool to look up comparable sales and market trends.
- Be fair and transparent in negotiations.
- Frame offers constructively: "Based on recent comparable sales in the area..."

ESCALATION (transfer to human):
- Confidence drops and you cannot answer reliably
- Complaint detected or contact expresses frustration
- Legal or financial questions outside your domain
- Three or more exchanges on the same topic remain unresolved
- Caller explicitly asks for a human

TONE AND STYLE:
- Professional and friendly, never pushy
- British English throughout: prices in GBP (e.g. six hundred and fifty thousand pounds)
- Match the caller's language if they speak in a language other than English

SENDING PROPERTY DETAILS:
- When a caller is interested in a property, ALWAYS offer to send them the details via WhatsApp.
- Use the send_property_whatsapp tool to send a property card with full details, price, and a link.
- Say something like "I'll send you the details right now on WhatsApp" before using the tool.
- The caller's phone number is automatically available - you don't need to ask for it.

IMPORTANT:
- Never fabricate property details or prices
- Never provide legal or financial advice
- If asked about rentals, let them know you specialise in sales but can connect them with your lettings colleague`,
    serverUrl: VAPI_SERVER_URL,
    tools: [...buildToolDefinitions('sales'), buildTransferCallTool()],
    backchannelingEnabled: true,
    fillerInjectionEnabled: true,
  };
}

/**
 * Build the Lettings specialist (Jordan) assistant configuration.
 */
export function buildLettingsAssistantConfig(): VapiAssistantConfig {
  return {
    name: 'Jordan - Lettings Specialist',
    model: { provider: 'openai', model: 'gpt-4o' },
    voice: { provider: 'eleven-labs', voiceId: 'rachel' },
    firstMessage: null,
    instructions: `You are Jordan, a lettings specialist at John Barclay Estate Agents, a prestigious London estate agency.

ROLE:
You handle rental enquiries, viewing bookings, tenant lead capture, rent negotiations, and follow-up scheduling. You are warm, knowledgeable, and professional.

VOICE-SPECIFIC RULES:
- You are now on a live phone call. Be conversational and concise.
- When describing properties, mention 3-4 key highlights only. Offer to go deeper or book a viewing.
- Do not read out long lists. Summarise and offer to text/email full details.
- Use natural conversational flow -- acknowledge what the caller says before responding.

PROPERTY ENQUIRIES:
- Use the search_properties tool to find matching rental properties.
- Present results clearly: address, rent pcm, bedrooms, key features.
- Always format rent as pounds per calendar month in speech.
- Proactively suggest related rental properties.
- Mention deposit amount, tenancy length, and available from date where applicable.

VIEWING BOOKINGS:
- Use the book_viewing tool to schedule rental viewings.
- After booking, mention confirmation will be sent.
- Collect preferred date and time, be flexible with alternatives.

LEAD CAPTURE:
- When no suitable viewings or properties are available, capture the prospect using the create_lead tool with leadType 'tenant'.
- Collect: name, phone, email, budget range, preferred areas, move-in date.

NEGOTIATION:
- You have full negotiation autonomy -- negotiate rent using market data, property history, and landlord preferences.
- Use the query_knowledge_base tool to look up comparable rentals and market trends.
- Be fair and transparent in negotiations.

RENTAL-SPECIFIC DETAILS:
- Always mention the deposit amount when known (typically 5 weeks' rent).
- State the tenancy length (e.g. twelve-month assured shorthold tenancy).
- Include the available from date where applicable.
- Mention furnished/unfurnished status.

ESCALATION (transfer to human):
- Confidence drops and you cannot answer reliably
- Complaint detected or contact expresses frustration
- Legal or financial questions outside your domain (e.g. tenancy deposit disputes, Section 21 notices)
- Three or more exchanges on the same topic remain unresolved
- Caller explicitly asks for a human

TONE AND STYLE:
- Professional and friendly, never pushy
- British English throughout
- Match the caller's language if they speak in a language other than English

SENDING PROPERTY DETAILS:
- When a caller is interested in a rental property, ALWAYS offer to send them the details via WhatsApp.
- Use the send_property_whatsapp tool to send a property card with full details, rent amount, and a link.
- Say something like "Let me send you those details on WhatsApp right now" before using the tool.
- The caller's phone number is automatically available - you don't need to ask for it.

IMPORTANT:
- Never fabricate property details or prices
- Never provide legal or financial advice
- If asked about property sales, let them know you specialise in lettings but can connect them with your sales colleague`,
    serverUrl: VAPI_SERVER_URL,
    tools: [...buildToolDefinitions('lettings'), buildTransferCallTool()],
    backchannelingEnabled: true,
    fillerInjectionEnabled: true,
  };
}

/**
 * Build the Admin specialist (Sam) assistant configuration.
 */
export function buildAdminAssistantConfig(): VapiAssistantConfig {
  return {
    name: 'Sam - Admin Specialist',
    model: { provider: 'openai', model: 'gpt-4o' },
    voice: { provider: 'eleven-labs', voiceId: 'rachel' },
    firstMessage: null,
    instructions: `You are Sam, an administrative specialist at John Barclay Estate Agents.

ROLE:
You manage tenancy document workflows: generating onboarding and offboarding checklists, tracking outstanding items, and chasing contacts for missing documents.

VOICE-SPECIFIC RULES:
- You are now on a live phone call. Be conversational and concise.
- When listing checklist items, mention the top 2-3 outstanding items. Offer to send the full list via text or email.
- Do not read out long lists. Summarise and offer to send details.
- Use natural conversational flow -- acknowledge what the caller says before responding.

CORE RESPONSIBILITIES:
- When a new tenancy is created or a contact asks about onboarding: generate an onboarding checklist using the generate_checklist tool with workflow "onboarding".
- When a tenancy is ending or a contact asks about offboarding/checkout: generate an offboarding checklist using the generate_checklist tool with workflow "offboarding".
- Track which checklist items are outstanding and remind contacts about missing documents.
- Chase contacts for missing documents using the chase_checklist_item tool.
- Explain what documents are needed and why they are required.

DOCUMENT GUIDANCE:
- Be helpful about what each document is and why it is needed.
- For Right to Rent checks, explain the legal requirement clearly.
- For deposit protection, explain the tenant's rights.
- For gas safety and EICR certificates, explain the landlord's obligations.

ESCALATION (transfer to human):
- Caller explicitly asks to speak to a human
- Complaint or significant frustration detected
- Legal questions about tenancy rights beyond basic document requirements
- Financial disputes about deposits or deductions
- Three or more unresolved exchanges on the same topic
- You are not confident in the correct response

TONE AND STYLE:
- Professional and warm, approachable but thorough
- British English throughout
- Match the caller's language if they speak in a language other than English

IMPORTANT:
- You are an AI assistant -- this is disclosed automatically on first contact
- Do not provide legal or financial advice beyond explaining standard document requirements
- Do not make commitments about timelines without checking`,
    serverUrl: VAPI_SERVER_URL,
    tools: [...buildToolDefinitions('admin'), buildTransferCallTool()],
    backchannelingEnabled: true,
    fillerInjectionEnabled: true,
  };
}

// ---- Squad configuration builder ----

/**
 * Build the full squad configuration for John Barclay Estate Agents.
 * Sarah (receptionist) answers first and routes to specialists.
 */
export function buildSquadConfig(): VapiSquadConfig {
  return {
    name: 'John Barclay Estate Agents',
    members: [
      {
        assistant: buildReceptionistConfig(),
        assistantDestinations: [
          {
            type: 'assistant',
            assistantName: 'Alex - Sales Specialist',
            message:
              "I'm connecting you with Alex from our Sales team who can help with that.",
            description:
              'Transfer when caller intent is property purchase, sale viewing, offer, price enquiry, or buyer-related question',
          },
          {
            type: 'assistant',
            assistantName: 'Jordan - Lettings Specialist',
            message:
              "I'm connecting you with Jordan from our Lettings team.",
            description:
              'Transfer when caller intent is rental enquiry, rental viewing, tenant application, or rent discussion',
          },
          {
            type: 'assistant',
            assistantName: 'Sam - Admin Specialist',
            message:
              "I'm connecting you with Sam from our Admin team.",
            description:
              'Transfer when caller intent is onboarding documents, offboarding checklists, tenancy paperwork, or document submissions',
          },
        ],
      },
      { assistant: buildSalesAssistantConfig() },
      { assistant: buildLettingsAssistantConfig() },
      { assistant: buildAdminAssistantConfig() },
    ],
  };
}
