/**
 * Agent Orchestrator
 * Central service that manages all agents, task queue, and message routing
 */

import { EventEmitter } from 'events';
import { SupervisorAgent, supervisorAgent } from './SupervisorAgent';
import { BaseAgent } from './BaseAgent';
import { SalesAgent, salesAgent } from './specialists/SalesAgent';
import { RentalAgent, rentalAgent } from './specialists/RentalAgent';
import { MaintenanceAgent, maintenanceAgent } from './specialists/MaintenanceAgent';
import { OfficeAdminAgent, officeAdminAgent } from './specialists/OfficeAdminAgent';
import { LeadGenSalesAgent, LeadGenRentalsAgent, leadGenSalesAgent, leadGenRentalsAgent } from './specialists/LeadGenAgent';
import { MarketingAgent, marketingAgent } from './specialists/MarketingAgent';
import {
  AgentType,
  AgentTask,
  AgentDecision,
  AgentEvent,
  IncomingMessage,
  TaskStatus,
  TaskPriority,
  AgentActivity,
} from './types';

interface QueuedTask {
  task: AgentTask;
  addedAt: Date;
  retries: number;
}

class AgentOrchestrator extends EventEmitter {
  private supervisor: SupervisorAgent;
  private taskQueue: Map<TaskPriority, QueuedTask[]> = new Map();
  private activeTasks: Map<string, AgentTask> = new Map();
  private completedTasks: AgentTask[] = [];
  private isProcessing: boolean = false;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.supervisor = supervisorAgent;

    // Initialize task queues by priority
    this.taskQueue.set('urgent', []);
    this.taskQueue.set('high', []);
    this.taskQueue.set('medium', []);
    this.taskQueue.set('low', []);

    // Register all specialist agents with supervisor
    this.registerAllAgents();

    console.log('[Orchestrator] Initialized with all agents registered');
  }

  /**
   * Register all specialist agents
   */
  private registerAllAgents(): void {
    this.supervisor.registerAgent(salesAgent);
    this.supervisor.registerAgent(rentalAgent);
    this.supervisor.registerAgent(maintenanceAgent);
    this.supervisor.registerAgent(officeAdminAgent);
    this.supervisor.registerAgent(leadGenSalesAgent);
    this.supervisor.registerAgent(leadGenRentalsAgent);
    this.supervisor.registerAgent(marketingAgent);
  }

  /**
   * Start the orchestrator (begin processing queue)
   */
  start(): void {
    if (this.processingInterval) {
      console.log('[Orchestrator] Already running');
      return;
    }

    console.log('[Orchestrator] Starting task processing...');
    this.isProcessing = true;

    // Process queue every 2 seconds
    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, 2000);

    this.emit('started');
  }

  /**
   * Stop the orchestrator
   */
  stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    this.isProcessing = false;
    console.log('[Orchestrator] Stopped');
    this.emit('stopped');
  }

  /**
   * Process incoming message - main entry point
   */
  async handleIncomingMessage(message: IncomingMessage): Promise<{
    taskId: string;
    status: TaskStatus;
    decision?: AgentDecision;
  }> {
    console.log(`[Orchestrator] Received message from ${message.from} via ${message.channel}`);

    try {
      // Let supervisor classify and route
      const result = await this.supervisor.processIncomingMessage(message);

      // Add task to queue
      this.addToQueue(result.task);

      // Emit event
      this.emitEvent({
        type: 'message_received',
        agentType: 'supervisor',
        taskId: result.task.id,
        data: { messageId: message.id, routing: result.routing },
        timestamp: new Date(),
      });

      return {
        taskId: result.task.id,
        status: result.task.status,
        decision: result.decision,
      };
    } catch (error) {
      console.error('[Orchestrator] Error handling message:', error);
      throw error;
    }
  }

  /**
   * Add task to appropriate priority queue
   */
  addToQueue(task: AgentTask): void {
    const queue = this.taskQueue.get(task.priority);
    if (queue) {
      queue.push({
        task,
        addedAt: new Date(),
        retries: 0,
      });
      console.log(`[Orchestrator] Task ${task.id} added to ${task.priority} queue (${queue.length} pending)`);
    }
  }

  /**
   * Process the task queue
   */
  private async processQueue(): Promise<void> {
    if (!this.isProcessing) return;

    // Process in priority order
    const priorities: TaskPriority[] = ['urgent', 'high', 'medium', 'low'];

    for (const priority of priorities) {
      const queue = this.taskQueue.get(priority);
      if (!queue || queue.length === 0) continue;

      // Get agent for the task
      const queuedTask = queue[0];
      const agent = this.supervisor.getRegisteredAgents().get(queuedTask.task.assignedTo);

      if (!agent) {
        console.warn(`[Orchestrator] No agent for ${queuedTask.task.assignedTo}`);
        continue;
      }

      // Check if agent is available and has capacity
      const config = agent.getConfig();
      const agentActiveTasks = Array.from(this.activeTasks.values())
        .filter(t => t.assignedTo === config.id && t.status === 'in_progress');

      if (agentActiveTasks.length >= config.maxConcurrentTasks) {
        // Agent at capacity, try next priority level
        continue;
      }

      // Remove from queue and process
      queue.shift();
      await this.processTask(queuedTask);

      // Only process one task per iteration to keep things responsive
      break;
    }
  }

  /**
   * Process a single task
   */
  private async processTask(queuedTask: QueuedTask): Promise<void> {
    const { task } = queuedTask;

    try {
      // Mark as in progress
      task.status = 'in_progress';
      task.updatedAt = new Date();
      this.activeTasks.set(task.id, task);

      this.emitEvent({
        type: 'task_started',
        agentType: task.assignedTo,
        taskId: task.id,
        data: { type: task.type, priority: task.priority },
        timestamp: new Date(),
      });

      // Route to supervisor for processing
      const decision = await this.supervisor.routeTask(task);

      // Update task based on decision
      task.output = { decision };
      task.updatedAt = new Date();

      if (decision.action === 'complete') {
        task.status = 'completed';
        task.completedAt = new Date();
        this.activeTasks.delete(task.id);
        this.completedTasks.push(task);

        this.emitEvent({
          type: 'task_completed',
          agentType: task.assignedTo,
          taskId: task.id,
          data: { decision },
          timestamp: new Date(),
        });
      } else if (decision.action === 'escalate') {
        task.status = 'escalated';
        task.escalationReason = decision.escalationReason;
        this.activeTasks.delete(task.id);

        this.emitEvent({
          type: 'task_escalated',
          agentType: task.assignedTo,
          taskId: task.id,
          data: { reason: decision.escalationReason },
          timestamp: new Date(),
        });
      } else if (decision.action === 'delegate') {
        // Re-assign to different agent
        if (decision.delegateTo) {
          task.assignedTo = decision.delegateTo;
          task.status = 'assigned';
          this.activeTasks.delete(task.id);
          this.addToQueue(task);
        }
      } else if (decision.action === 'wait') {
        task.status = 'awaiting_response';
        // Keep in active tasks but mark as waiting
      } else {
        // respond, schedule, create_task, etc - task continues
        task.status = 'in_progress';
      }

      // Handle any sub-tasks created
      if (decision.createTasks && decision.createTasks.length > 0) {
        for (const subTaskData of decision.createTasks) {
          const subTask: AgentTask = {
            id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: subTaskData.type || 'general_response',
            title: subTaskData.title || 'Sub-task',
            description: subTaskData.description || '',
            priority: subTaskData.priority || 'medium',
            status: 'pending',
            assignedTo: subTaskData.assignedTo || task.assignedTo,
            assignedBy: task.assignedTo,
            createdAt: new Date(),
            updatedAt: new Date(),
            parentTaskId: task.id,
            input: subTaskData.input || {},
            attempts: 0,
            maxAttempts: 3,
          };

          this.addToQueue(subTask);
        }
      }

    } catch (error) {
      console.error(`[Orchestrator] Error processing task ${task.id}:`, error);

      queuedTask.retries++;
      task.attempts++;

      if (queuedTask.retries < 3) {
        // Re-queue for retry
        task.status = 'pending';
        task.lastError = error instanceof Error ? error.message : 'Unknown error';
        this.activeTasks.delete(task.id);
        this.addToQueue(task);
      } else {
        // Max retries reached, escalate
        task.status = 'escalated';
        task.escalationReason = `Failed after ${queuedTask.retries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`;
        this.activeTasks.delete(task.id);

        this.emitEvent({
          type: 'task_failed',
          agentType: task.assignedTo,
          taskId: task.id,
          data: { error: task.lastError, attempts: task.attempts },
          timestamp: new Date(),
        });
      }
    }
  }

  /**
   * Manually create and queue a task
   */
  createTask(taskData: Partial<AgentTask>): AgentTask {
    const task: AgentTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: taskData.type || 'general_response',
      title: taskData.title || 'Manual Task',
      description: taskData.description || '',
      priority: taskData.priority || 'medium',
      status: 'pending',
      assignedTo: taskData.assignedTo || 'office_admin',
      assignedBy: 'supervisor',
      createdAt: new Date(),
      updatedAt: new Date(),
      propertyId: taskData.propertyId,
      contactId: taskData.contactId,
      input: taskData.input || {},
      attempts: 0,
      maxAttempts: 3,
    };

    this.addToQueue(task);
    return task;
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): AgentTask | undefined {
    // Check active tasks
    const activeTask = this.activeTasks.get(taskId);
    if (activeTask) return activeTask;

    // Check completed tasks
    const completedTask = this.completedTasks.find(t => t.id === taskId);
    if (completedTask) return completedTask;

    // Check queues
    for (const [_, queue] of this.taskQueue) {
      const queuedTask = queue.find(qt => qt.task.id === taskId);
      if (queuedTask) return queuedTask.task;
    }

    return undefined;
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    queued: { urgent: number; high: number; medium: number; low: number };
    active: number;
    completed: number;
    processing: boolean;
  } {
    return {
      queued: {
        urgent: this.taskQueue.get('urgent')?.length || 0,
        high: this.taskQueue.get('high')?.length || 0,
        medium: this.taskQueue.get('medium')?.length || 0,
        low: this.taskQueue.get('low')?.length || 0,
      },
      active: this.activeTasks.size,
      completed: this.completedTasks.length,
      processing: this.isProcessing,
    };
  }

  /**
   * Get system status
   */
  getSystemStatus(): {
    orchestrator: ReturnType<AgentOrchestrator['getQueueStatus']>;
    supervisor: ReturnType<SupervisorAgent['getSystemStatus']>;
    agents: ReturnType<SupervisorAgent['getAgentPerformance']>;
  } {
    return {
      orchestrator: this.getQueueStatus(),
      supervisor: this.supervisor.getSystemStatus(),
      agents: this.supervisor.getAgentPerformance(),
    };
  }

  /**
   * Get recent tasks
   */
  getRecentTasks(limit: number = 50): AgentTask[] {
    const allTasks = [
      ...Array.from(this.activeTasks.values()),
      ...this.completedTasks.slice(-limit),
    ];

    return allTasks
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit);
  }

  /**
   * Emit agent event
   */
  private emitEvent(event: AgentEvent): void {
    this.emit('agent_event', event);
    this.emit(event.type, event);
  }

  /**
   * Get supervisor agent
   */
  getSupervisor(): SupervisorAgent {
    return this.supervisor;
  }

  /**
   * Get specific agent
   */
  getAgent(agentType: AgentType): BaseAgent | undefined {
    return this.supervisor.getRegisteredAgents().get(agentType);
  }
}

// Export singleton instance
export const agentOrchestrator = new AgentOrchestrator();

export { AgentOrchestrator };
