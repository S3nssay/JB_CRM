/**
 * Base Agent Class
 * All specialist agents extend this class
 */

import {
  AgentType,
  AgentConfig,
  AgentTask,
  AgentDecision,
  AgentActivity,
  TaskContext,
  IncomingMessage,
  OutgoingMessage,
  ConversationMessage,
  TaskStatus,
  TaskPriority,
} from './types';
import { openaiClient, isOpenAIConfigured } from '../lib/openaiClient';

// Initialize OpenAI client
const openai = openaiClient;

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected activities: AgentActivity[] = [];

  constructor(config: AgentConfig) {
    this.config = config;
  }

  /**
   * Get agent configuration
   */
  getConfig(): AgentConfig {
    return this.config;
  }

  /**
   * Check if agent is currently active (within working hours)
   */
  isActive(): boolean {
    if (!this.config.enabled) return false;

    const now = new Date();
    const currentDay = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][now.getDay()];

    if (!this.config.workingDays.includes(currentDay)) {
      return false;
    }

    const currentTime = now.toTimeString().slice(0, 5);
    return currentTime >= this.config.workingHours.start &&
           currentTime <= this.config.workingHours.end;
  }

  /**
   * Check if agent can handle a specific task type
   */
  canHandle(taskType: string): boolean {
    return this.config.handlesTaskTypes.includes(taskType as any);
  }

  /**
   * Process a task - main entry point for task execution
   */
  async processTask(task: AgentTask): Promise<AgentDecision> {
    const startTime = Date.now();

    try {
      // Log activity start
      console.log(`[${this.config.id}] Processing task: ${task.id} - ${task.type}`);

      // Build context for the task
      const context = await this.buildContext(task);

      // Make decision using AI
      const decision = await this.makeDecision(task, context);

      // Execute the decision
      const result = await this.executeDecision(task, decision);

      // Log activity
      this.logActivity({
        id: `activity_${Date.now()}`,
        agentType: this.config.id,
        action: task.type,
        taskId: task.id,
        input: task.input,
        output: result,
        duration: Date.now() - startTime,
        success: true,
        timestamp: new Date(),
      });

      return decision;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Log failed activity
      this.logActivity({
        id: `activity_${Date.now()}`,
        agentType: this.config.id,
        action: task.type,
        taskId: task.id,
        input: task.input,
        duration: Date.now() - startTime,
        success: false,
        error: errorMessage,
        timestamp: new Date(),
      });

      // Return escalation decision on error
      return {
        action: 'escalate',
        reasoning: `Error processing task: ${errorMessage}`,
        confidence: 0,
        escalate: true,
        escalationReason: errorMessage,
      };
    }
  }

  /**
   * Build context for task processing
   */
  protected async buildContext(task: AgentTask): Promise<TaskContext> {
    return {
      conversationHistory: task.context?.conversationHistory || [],
      contact: task.context?.contact,
      property: task.context?.property,
      previousTasks: task.context?.previousTasks || [],
      agentContext: {
        agentType: this.config.id,
        agentName: this.config.name,
        personality: this.config.personality,
        tone: this.config.tone,
      },
    };
  }

  /**
   * Make a decision using AI
   */
  protected async makeDecision(task: AgentTask, context: TaskContext): Promise<AgentDecision> {
    const systemPrompt = this.buildSystemPrompt(context);
    const userPrompt = this.buildUserPrompt(task, context);

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI');
      }

      const decision = JSON.parse(content) as AgentDecision;

      // Validate decision
      if (!decision.action || decision.confidence === undefined) {
        throw new Error('Invalid decision format');
      }

      return decision;
    } catch (error) {
      console.error(`[${this.config.id}] AI decision error:`, error);

      // Return default escalation decision
      return {
        action: 'escalate',
        reasoning: 'Unable to process request automatically',
        confidence: 0,
        escalate: true,
        escalationReason: 'AI processing failed',
      };
    }
  }

  /**
   * Build system prompt for AI
   */
  protected buildSystemPrompt(context: TaskContext): string {
    const basePrompt = `You are ${this.config.name}, an AI agent for John Barclay Estate & Management, a prestigious estate agency in West London.

Your role: ${this.config.description}

Personality: ${this.config.personality}
Communication tone: ${this.config.tone}
${this.config.customPrompt ? `\nAdditional instructions: ${this.config.customPrompt}` : ''}

IMPORTANT GUIDELINES:
1. Always maintain a ${this.config.tone} tone in all communications
2. Be helpful, accurate, and professional
3. If you're unsure about something, escalate to a human
4. Never make promises you can't keep
5. Protect customer data and privacy
6. Follow UK property regulations and laws

You must respond with a JSON object containing:
{
  "action": "respond" | "schedule" | "create_task" | "update_record" | "send_document" | "escalate" | "delegate" | "wait" | "complete",
  "reasoning": "Your reasoning for this decision",
  "confidence": 0.0-1.0,
  "suggestedResponse": "The response to send to the customer (if applicable)",
  "nextSteps": ["Array of suggested next steps"],
  "escalate": true/false,
  "escalationReason": "Why escalation is needed (if applicable)",
  "delegateTo": "agent_type if delegating",
  "createTasks": [{ task objects if creating sub-tasks }]
}`;

    return basePrompt;
  }

  /**
   * Build user prompt for specific task
   */
  protected abstract buildUserPrompt(task: AgentTask, context: TaskContext): string;

  /**
   * Execute a decision
   */
  protected async executeDecision(task: AgentTask, decision: AgentDecision): Promise<Record<string, any>> {
    switch (decision.action) {
      case 'respond':
        return this.handleRespond(task, decision);
      case 'schedule':
        return this.handleSchedule(task, decision);
      case 'create_task':
        return this.handleCreateTask(task, decision);
      case 'update_record':
        return this.handleUpdateRecord(task, decision);
      case 'send_document':
        return this.handleSendDocument(task, decision);
      case 'escalate':
        return this.handleEscalate(task, decision);
      case 'delegate':
        return this.handleDelegate(task, decision);
      case 'wait':
        return this.handleWait(task, decision);
      case 'complete':
        return this.handleComplete(task, decision);
      default:
        throw new Error(`Unknown action: ${decision.action}`);
    }
  }

  /**
   * Handle respond action
   */
  protected async handleRespond(task: AgentTask, decision: AgentDecision): Promise<Record<string, any>> {
    if (!decision.suggestedResponse) {
      throw new Error('No response content provided');
    }

    // The actual sending will be handled by the message service
    return {
      action: 'respond',
      response: decision.suggestedResponse,
      channel: task.input.channel || 'email',
      recipient: task.input.from,
    };
  }

  /**
   * Handle schedule action
   */
  protected async handleSchedule(task: AgentTask, decision: AgentDecision): Promise<Record<string, any>> {
    return {
      action: 'schedule',
      type: task.input.scheduleType || 'viewing',
      details: decision.suggestedResponse,
    };
  }

  /**
   * Handle create task action
   */
  protected async handleCreateTask(task: AgentTask, decision: AgentDecision): Promise<Record<string, any>> {
    return {
      action: 'create_task',
      tasks: decision.createTasks || [],
    };
  }

  /**
   * Handle update record action
   */
  protected async handleUpdateRecord(task: AgentTask, decision: AgentDecision): Promise<Record<string, any>> {
    return {
      action: 'update_record',
      updates: task.input.updates || {},
    };
  }

  /**
   * Handle send document action
   */
  protected async handleSendDocument(task: AgentTask, decision: AgentDecision): Promise<Record<string, any>> {
    return {
      action: 'send_document',
      documentType: task.input.documentType,
      recipient: task.input.recipient,
    };
  }

  /**
   * Handle escalate action
   */
  protected async handleEscalate(task: AgentTask, decision: AgentDecision): Promise<Record<string, any>> {
    return {
      action: 'escalate',
      reason: decision.escalationReason,
      originalTask: task.id,
    };
  }

  /**
   * Handle delegate action
   */
  protected async handleDelegate(task: AgentTask, decision: AgentDecision): Promise<Record<string, any>> {
    return {
      action: 'delegate',
      delegateTo: decision.delegateTo,
      task: task,
    };
  }

  /**
   * Handle wait action
   */
  protected async handleWait(task: AgentTask, decision: AgentDecision): Promise<Record<string, any>> {
    return {
      action: 'wait',
      waitFor: decision.nextSteps?.[0] || 'customer_response',
    };
  }

  /**
   * Handle complete action
   */
  protected async handleComplete(task: AgentTask, decision: AgentDecision): Promise<Record<string, any>> {
    return {
      action: 'complete',
      summary: decision.reasoning,
    };
  }

  /**
   * Log agent activity
   */
  protected logActivity(activity: AgentActivity): void {
    this.activities.push(activity);

    // Keep only last 1000 activities in memory
    if (this.activities.length > 1000) {
      this.activities = this.activities.slice(-1000);
    }

    // Also log to console for debugging
    console.log(`[${activity.agentType}] ${activity.action} - ${activity.success ? 'SUCCESS' : 'FAILED'} (${activity.duration}ms)`);
  }

  /**
   * Get recent activities
   */
  getActivities(limit: number = 100): AgentActivity[] {
    return this.activities.slice(-limit);
  }

  /**
   * Get agent metrics
   */
  getMetrics(): {
    tasksCompleted: number;
    tasksFailed: number;
    averageResponseTime: number;
    successRate: number;
  } {
    const completed = this.activities.filter(a => a.success).length;
    const failed = this.activities.filter(a => !a.success).length;
    const totalTime = this.activities.reduce((sum, a) => sum + a.duration, 0);

    return {
      tasksCompleted: completed,
      tasksFailed: failed,
      averageResponseTime: this.activities.length > 0 ? totalTime / this.activities.length : 0,
      successRate: this.activities.length > 0 ? (completed / this.activities.length) * 100 : 0,
    };
  }

  /**
   * Generate a response for a message
   */
  async generateResponse(message: IncomingMessage, context?: TaskContext): Promise<string> {
    const systemPrompt = `You are ${this.config.name} responding to a customer message for John Barclay Estate & Management.

Personality: ${this.config.personality}
Tone: ${this.config.tone}

Generate a professional, helpful response. Be concise but thorough.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Customer message: ${message.body}\n\nGenerate an appropriate response.` },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    return response.choices[0]?.message?.content || 'Thank you for your message. A member of our team will be in touch shortly.';
  }
}
