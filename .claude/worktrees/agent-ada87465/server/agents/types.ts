/**
 * Multi-Agent AI System Types
 * John Barclay Estate & Management
 */

// Agent Types
export type AgentType =
  | 'supervisor'
  | 'office_admin'
  | 'sales'
  | 'rental'
  | 'maintenance'
  | 'lead_gen_sales'
  | 'lead_gen_rentals'
  | 'marketing';

// Task Priority Levels
export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';

// Task Status
export type TaskStatus =
  | 'pending'
  | 'assigned'
  | 'in_progress'
  | 'awaiting_response'
  | 'completed'
  | 'failed'
  | 'escalated';

// Communication Channels
export type CommunicationChannel = 'email' | 'whatsapp' | 'sms' | 'phone' | 'post' | 'social_media';

// Message Types
export type MessageType =
  | 'inquiry'
  | 'viewing_request'
  | 'offer'
  | 'complaint'
  | 'maintenance_request'
  | 'contract_request'
  | 'valuation_request'
  | 'general'
  | 'lead'
  | 'follow_up';

// Incoming Message from any channel
export interface IncomingMessage {
  id: string;
  channel: CommunicationChannel;
  from: string;
  fromName?: string;
  to?: string;
  subject?: string;
  body: string;
  timestamp: Date;
  metadata?: Record<string, any>;
  attachments?: Attachment[];
  propertyId?: number;
  contactId?: number;
  conversationId?: string;
}

export interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url?: string;
}

// Outgoing Message
export interface OutgoingMessage {
  channel: CommunicationChannel;
  to: string;
  toName?: string;
  subject?: string;
  body: string;
  templateId?: string;
  templateData?: Record<string, any>;
  attachments?: Attachment[];
  scheduledAt?: Date;
  priority?: TaskPriority;
}

// Task assigned to an agent
export interface AgentTask {
  id: string;
  type: TaskType;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignedTo: AgentType;
  assignedBy?: AgentType;
  createdAt: Date;
  updatedAt: Date;
  dueAt?: Date;
  completedAt?: Date;

  // Related entities
  propertyId?: number;
  contactId?: number;
  conversationId?: string;
  parentTaskId?: string;
  childTaskIds?: string[];

  // Task data
  input: Record<string, any>;
  output?: Record<string, any>;
  context?: TaskContext;

  // Execution
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  escalationReason?: string;
}

export type TaskType =
  | 'classify_message'
  | 'respond_to_inquiry'
  | 'schedule_viewing'
  | 'process_offer'
  | 'handle_complaint'
  | 'create_maintenance_ticket'
  | 'dispatch_contractor'
  | 'send_contract'
  | 'follow_up_lead'
  | 'generate_valuation'
  | 'post_to_social'
  | 'create_listing'
  | 'send_notification'
  | 'escalate_to_human'
  | 'update_crm'
  | 'general_response';

// Context passed to agents for decision making
export interface TaskContext {
  // Conversation history
  conversationHistory?: ConversationMessage[];

  // Contact information
  contact?: ContactInfo;

  // Property information
  property?: PropertyInfo;

  // Previous interactions
  previousTasks?: AgentTask[];

  // Agent-specific context
  agentContext?: Record<string, any>;
}

export interface ConversationMessage {
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: Date;
  channel?: CommunicationChannel;
  agentType?: AgentType;
}

export interface ContactInfo {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  type: 'buyer' | 'seller' | 'tenant' | 'landlord' | 'vendor' | 'unknown';
  preferences?: Record<string, any>;
  history?: {
    totalInteractions: number;
    lastInteraction?: Date;
    viewingsAttended?: number;
    offersSubmitted?: number;
    propertiesOwned?: number;
  };
}

export interface PropertyInfo {
  id: number;
  address: string;
  postcode: string;
  type: string;
  bedrooms: number;
  price: number;
  status: string;
  listingType: 'sale' | 'rental' | 'commercial';
}

// Agent Configuration
export interface AgentConfig {
  id: AgentType;
  name: string;
  description: string;
  enabled: boolean;

  // Capabilities
  handlesMessageTypes: MessageType[];
  handlesTaskTypes: TaskType[];
  communicationChannels: CommunicationChannel[];

  // Behavior
  personality: string;
  tone: 'formal' | 'friendly' | 'professional';
  language: string;
  customPrompt?: string;

  // Operational
  workingHours: { start: string; end: string };
  workingDays: string[];
  responseDelaySeconds: number;
  maxConcurrentTasks: number;

  // Routing
  priorityPostcodes?: string[];
  escalationThreshold?: number;
}

// Agent Decision/Action
export interface AgentDecision {
  action: AgentAction;
  reasoning: string;
  confidence: number;
  suggestedResponse?: string;
  nextSteps?: string[];
  escalate?: boolean;
  escalationReason?: string;
  delegateTo?: AgentType;
  createTasks?: Partial<AgentTask>[];
}

export type AgentAction =
  | 'respond'
  | 'schedule'
  | 'create_task'
  | 'update_record'
  | 'send_document'
  | 'escalate'
  | 'delegate'
  | 'wait'
  | 'complete';

// Agent Activity Log
export interface AgentActivity {
  id: string;
  agentType: AgentType;
  action: string;
  taskId?: string;
  input?: Record<string, any>;
  output?: Record<string, any>;
  duration: number;
  success: boolean;
  error?: string;
  timestamp: Date;
}

// Agent Metrics
export interface AgentMetrics {
  agentType: AgentType;
  period: 'hour' | 'day' | 'week' | 'month';
  tasksCompleted: number;
  tasksEscalated: number;
  averageResponseTime: number;
  successRate: number;
  messagesProcessed: number;
  customerSatisfaction?: number;
}

// Supervisor Decision for routing
export interface RoutingDecision {
  messageType: MessageType;
  assignTo: AgentType;
  priority: TaskPriority;
  reasoning: string;
  confidence: number;
  suggestedTaskType: TaskType;
}

// Event emitted by agents
export interface AgentEvent {
  type: AgentEventType;
  agentType: AgentType;
  taskId?: string;
  data: Record<string, any>;
  timestamp: Date;
}

export type AgentEventType =
  | 'task_started'
  | 'task_completed'
  | 'task_failed'
  | 'task_escalated'
  | 'message_sent'
  | 'message_received'
  | 'decision_made'
  | 'error_occurred'
  | 'human_intervention_required';
