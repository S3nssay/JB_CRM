/**
 * Supervisor Agent
 * The master agent that oversees all operations, routes tasks, and makes high-level decisions
 */

import { BaseAgent } from './BaseAgent';
import {
  AgentType,
  AgentConfig,
  AgentTask,
  AgentDecision,
  TaskContext,
  IncomingMessage,
  MessageType,
  RoutingDecision,
  TaskPriority,
  TaskType,
  TaskStatus,
} from './types';
import { openaiClient, isOpenAIConfigured } from '../lib/openaiClient';

const openai = openaiClient;

export class SupervisorAgent extends BaseAgent {
  private agentRegistry: Map<AgentType, BaseAgent> = new Map();

  constructor() {
    super({
      id: 'supervisor',
      name: 'Supervisor Agent',
      description: 'Oversees all business operations, routes tasks to specialist agents, monitors performance, and makes high-level decisions',
      enabled: true,
      handlesMessageTypes: ['inquiry', 'viewing_request', 'offer', 'complaint', 'maintenance_request', 'contract_request', 'valuation_request', 'general', 'lead', 'follow_up'],
      handlesTaskTypes: ['classify_message', 'escalate_to_human', 'general_response'],
      communicationChannels: ['email', 'whatsapp', 'sms', 'phone', 'post', 'social_media'],
      personality: 'Professional business manager with deep knowledge of estate agency operations',
      tone: 'professional',
      language: 'en-GB',
      workingHours: { start: '00:00', end: '23:59' }, // Always on
      workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      responseDelaySeconds: 0,
      maxConcurrentTasks: 100,
    });
  }

  /**
   * Register a specialist agent
   */
  registerAgent(agent: BaseAgent): void {
    this.agentRegistry.set(agent.getConfig().id, agent);
    console.log(`[Supervisor] Registered agent: ${agent.getConfig().name}`);
  }

  /**
   * Get all registered agents
   */
  getRegisteredAgents(): Map<AgentType, BaseAgent> {
    return this.agentRegistry;
  }

  /**
   * Classify an incoming message and determine routing
   */
  async classifyMessage(message: IncomingMessage): Promise<RoutingDecision> {
    const prompt = `Analyze this incoming message and determine:
1. The type of message (inquiry, viewing_request, offer, complaint, maintenance_request, contract_request, valuation_request, general, lead, follow_up)
2. The most appropriate agent to handle it:
   - sales: Property sales, valuations, buyer inquiries, offers on sale properties
   - rental: Rental inquiries, tenant matching, viewing scheduling for rentals
   - maintenance: Repair requests, property issues, contractor coordination
   - office_admin: Contract management, general admin, document handling
   - lead_gen_sales: New vendor leads, valuation requests for selling
   - lead_gen_rentals: New landlord leads, rental valuation requests
   - marketing: Social media, marketing campaigns, content requests
3. Priority level (urgent, high, medium, low)

Message Details:
Channel: ${message.channel}
From: ${message.fromName || message.from}
Subject: ${message.subject || 'N/A'}
Content: ${message.body}

Respond with a JSON object:
{
  "messageType": "the message type",
  "assignTo": "agent type",
  "priority": "priority level",
  "reasoning": "brief explanation",
  "confidence": 0.0-1.0,
  "suggestedTaskType": "the task type to create"
}`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an expert message classifier for a London estate agency. Analyze messages and route them to the appropriate specialist agent.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 500,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No classification response');
      }

      const classification = JSON.parse(content) as RoutingDecision;
      console.log(`[Supervisor] Classified message as ${classification.messageType} -> ${classification.assignTo} (${classification.confidence * 100}% confidence)`);

      return classification;
    } catch (error) {
      console.error('[Supervisor] Classification error:', error);

      // Default to office admin for unclassifiable messages
      return {
        messageType: 'general',
        assignTo: 'office_admin',
        priority: 'medium',
        reasoning: 'Unable to classify automatically, routing to office admin',
        confidence: 0.3,
        suggestedTaskType: 'general_response',
      };
    }
  }

  /**
   * Create a task from an incoming message
   */
  async createTaskFromMessage(message: IncomingMessage, routing: RoutingDecision): Promise<AgentTask> {
    const task: AgentTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: routing.suggestedTaskType as TaskType,
      title: this.generateTaskTitle(message, routing),
      description: message.body.substring(0, 500),
      priority: routing.priority,
      status: 'pending',
      assignedTo: routing.assignTo,
      assignedBy: 'supervisor',
      createdAt: new Date(),
      updatedAt: new Date(),
      propertyId: message.propertyId,
      contactId: message.contactId,
      conversationId: message.conversationId,
      input: {
        message,
        routing,
        channel: message.channel,
        from: message.from,
        fromName: message.fromName,
        subject: message.subject,
        body: message.body,
      },
      attempts: 0,
      maxAttempts: 3,
    };

    return task;
  }

  /**
   * Generate a task title from message
   */
  private generateTaskTitle(message: IncomingMessage, routing: RoutingDecision): string {
    const typeLabels: Record<MessageType, string> = {
      inquiry: 'Property Inquiry',
      viewing_request: 'Viewing Request',
      offer: 'Offer Received',
      complaint: 'Complaint',
      maintenance_request: 'Maintenance Request',
      contract_request: 'Contract Request',
      valuation_request: 'Valuation Request',
      general: 'General Inquiry',
      lead: 'New Lead',
      follow_up: 'Follow Up Required',
    };

    const label = typeLabels[routing.messageType] || 'Task';
    const from = message.fromName || message.from;
    return `${label} from ${from}`.substring(0, 100);
  }

  /**
   * Route a task to the appropriate agent
   */
  async routeTask(task: AgentTask): Promise<AgentDecision> {
    const agent = this.agentRegistry.get(task.assignedTo);

    if (!agent) {
      console.warn(`[Supervisor] No agent found for type: ${task.assignedTo}, handling directly`);
      return this.processTask(task);
    }

    if (!agent.isActive()) {
      console.log(`[Supervisor] Agent ${task.assignedTo} is not active, queuing task`);
      return {
        action: 'wait',
        reasoning: `Agent ${task.assignedTo} is currently offline. Task queued for processing.`,
        confidence: 1.0,
        nextSteps: ['Wait for agent to become active', 'Process when available'],
      };
    }

    // Delegate to the specialist agent
    console.log(`[Supervisor] Routing task ${task.id} to ${task.assignedTo}`);
    return agent.processTask(task);
  }

  /**
   * Process incoming message - main entry point
   */
  async processIncomingMessage(message: IncomingMessage): Promise<{
    task: AgentTask;
    decision: AgentDecision;
    routing: RoutingDecision;
  }> {
    // Step 1: Classify the message
    const routing = await this.classifyMessage(message);

    // Step 2: Create a task
    const task = await this.createTaskFromMessage(message, routing);

    // Step 3: Route to appropriate agent
    const decision = await this.routeTask(task);

    // Step 4: Update task status based on decision
    task.status = this.getTaskStatusFromDecision(decision);
    task.output = {
      decision,
      routing,
    };

    return { task, decision, routing };
  }

  /**
   * Get task status from decision
   */
  private getTaskStatusFromDecision(decision: AgentDecision): TaskStatus {
    switch (decision.action) {
      case 'complete':
        return 'completed';
      case 'escalate':
        return 'escalated';
      case 'wait':
        return 'awaiting_response';
      case 'delegate':
        return 'assigned';
      default:
        return 'in_progress';
    }
  }

  /**
   * Monitor agent performance
   */
  getAgentPerformance(): Record<AgentType, {
    name: string;
    enabled: boolean;
    isActive: boolean;
    metrics: ReturnType<BaseAgent['getMetrics']>;
  }> {
    const performance: Record<string, any> = {};

    for (const [type, agent] of this.agentRegistry) {
      const config = agent.getConfig();
      performance[type] = {
        name: config.name,
        enabled: config.enabled,
        isActive: agent.isActive(),
        metrics: agent.getMetrics(),
      };
    }

    return performance as any;
  }

  /**
   * Handle escalation from other agents
   */
  async handleEscalation(task: AgentTask, reason: string): Promise<AgentDecision> {
    console.log(`[Supervisor] Handling escalation for task ${task.id}: ${reason}`);

    // Try to reassign to a different agent or escalate to human
    const alternativeAgents = this.findAlternativeAgents(task);

    if (alternativeAgents.length > 0) {
      const newAgent = alternativeAgents[0];
      console.log(`[Supervisor] Reassigning to ${newAgent}`);

      task.assignedTo = newAgent;
      task.attempts++;
      task.updatedAt = new Date();

      return this.routeTask(task);
    }

    // No alternative agents, escalate to human
    return {
      action: 'escalate',
      reasoning: `Task requires human intervention: ${reason}`,
      confidence: 1.0,
      escalate: true,
      escalationReason: reason,
      nextSteps: ['Notify human staff', 'Add to priority queue'],
    };
  }

  /**
   * Find alternative agents that could handle a task
   */
  private findAlternativeAgents(task: AgentTask): AgentType[] {
    const alternatives: AgentType[] = [];

    for (const [type, agent] of this.agentRegistry) {
      if (type !== task.assignedTo && agent.canHandle(task.type) && agent.isActive()) {
        alternatives.push(type);
      }
    }

    return alternatives;
  }

  /**
   * Build user prompt for task processing
   */
  protected buildUserPrompt(task: AgentTask, context: TaskContext): string {
    return `
Task ID: ${task.id}
Type: ${task.type}
Priority: ${task.priority}
Description: ${task.description}

Input Data:
${JSON.stringify(task.input, null, 2)}

Context:
${context.contact ? `Contact: ${context.contact.name} (${context.contact.type})` : 'No contact info'}
${context.property ? `Property: ${context.property.address}` : 'No property info'}
${context.conversationHistory?.length ? `Conversation History: ${context.conversationHistory.length} messages` : 'No history'}

As the Supervisor Agent, determine the best course of action for this task.
`;
  }

  /**
   * Get system status summary
   */
  getSystemStatus(): {
    totalAgents: number;
    activeAgents: number;
    totalTasksProcessed: number;
    averageResponseTime: number;
    overallSuccessRate: number;
  } {
    const agentPerformance = this.getAgentPerformance();
    const agentTypes = Object.keys(agentPerformance);

    let totalTasks = 0;
    let totalTime = 0;
    let totalSuccess = 0;
    let activeCount = 0;

    for (const type of agentTypes) {
      const perf = agentPerformance[type as AgentType];
      if (perf.isActive) activeCount++;
      totalTasks += perf.metrics.tasksCompleted + perf.metrics.tasksFailed;
      totalTime += perf.metrics.averageResponseTime * (perf.metrics.tasksCompleted + perf.metrics.tasksFailed);
      totalSuccess += perf.metrics.tasksCompleted;
    }

    return {
      totalAgents: agentTypes.length,
      activeAgents: activeCount,
      totalTasksProcessed: totalTasks,
      averageResponseTime: totalTasks > 0 ? totalTime / totalTasks : 0,
      overallSuccessRate: totalTasks > 0 ? (totalSuccess / totalTasks) * 100 : 0,
    };
  }
}

// Export singleton instance
export const supervisorAgent = new SupervisorAgent();
