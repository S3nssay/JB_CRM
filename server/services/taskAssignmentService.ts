/**
 * Task Assignment Service
 *
 * Creates tasks from email AI analysis and assigns them to the right person.
 * Assignment logic: property PM > lead agent > department routing > round-robin > fallback.
 */

import { db } from '../db';
import {
  tasks,
  properties,
  leads,
  users,
  assignmentRules,
  Task,
} from '@shared/schema';
import { eq, and, sql, ne, asc, desc } from 'drizzle-orm';
import type { AiAnalysisResult } from './email/emailProcessor';

export interface TaskContext {
  department: string | null;
  propertyId: number | null;
  leadId: number | null;
  landlordId: number | null;
  tenantId: number | null;
  ticketId: number | null;
  sourceEmailId: number | null;
}

// SLA deadlines by priority
const SLA_HOURS: Record<string, number> = {
  urgent: 1,
  high: 4,
  normal: 24,
  low: 72,
};

class TaskAssignmentService {

  /**
   * Create tasks from AI-extracted task list and assign to appropriate staff
   */
  async createTasksFromEmail(
    aiTasks: AiAnalysisResult['tasks'],
    context: TaskContext,
    fallbackUserId?: number
  ): Promise<Task[]> {
    if (!aiTasks || aiTasks.length === 0) {
      return [];
    }

    const createdTasks: Task[] = [];

    for (const aiTask of aiTasks) {
      try {
        const assignedToId = await this.determineAssignee({
          taskType: aiTask.taskType,
          department: context.department,
          propertyId: context.propertyId,
          leadId: context.leadId,
          landlordId: context.landlordId,
          tenantId: context.tenantId,
        });

        const effectiveAssignee = assignedToId || fallbackUserId;
        if (!effectiveAssignee) {
          console.warn(`[TaskAssignment] No assignee found for task: ${aiTask.title}, skipping`);
          continue;
        }

        const priority = aiTask.priority || 'normal';
        const dueDate = this.calculateDueDate(priority, aiTask.dueWithinHours);
        const slaDeadline = this.calculateSlaDeadline(priority);

        const [task] = await db.insert(tasks).values({
          title: aiTask.title,
          description: aiTask.description,
          taskType: aiTask.taskType,
          priority,
          status: 'pending',
          assignedToId: effectiveAssignee,
          propertyId: context.propertyId || undefined,
          leadId: context.leadId || undefined,
          landlordId: context.landlordId || undefined,
          tenantId: context.tenantId || undefined,
          sourceEmailId: context.sourceEmailId || undefined,
          sourceTicketId: context.ticketId || undefined,
          slaDeadline,
          dueDate,
        }).returning();

        createdTasks.push(task);
        console.log(`[TaskAssignment] Created task "${task.title}" assigned to user ${effectiveAssignee}, due ${dueDate?.toISOString()}`);

      } catch (error) {
        console.error(`[TaskAssignment] Failed to create task "${aiTask.title}":`, error);
      }
    }

    return createdTasks;
  }

  /**
   * Create a single task (for non-AI-generated tasks)
   */
  async createTask(
    title: string,
    taskType: string,
    priority: string,
    description: string,
    context: TaskContext,
    assignedToOverride?: number
  ): Promise<Task | null> {
    const assignedToId = assignedToOverride || await this.determineAssignee({
      taskType,
      department: context.department,
      propertyId: context.propertyId,
      leadId: context.leadId,
      landlordId: context.landlordId,
      tenantId: context.tenantId,
    });

    if (!assignedToId) {
      console.warn(`[TaskAssignment] No assignee for task: ${title}`);
      return null;
    }

    const dueDate = this.calculateDueDate(priority);
    const slaDeadline = this.calculateSlaDeadline(priority);

    const [task] = await db.insert(tasks).values({
      title,
      description,
      taskType,
      priority,
      status: 'pending',
      assignedToId,
      propertyId: context.propertyId || undefined,
      leadId: context.leadId || undefined,
      landlordId: context.landlordId || undefined,
      tenantId: context.tenantId || undefined,
      sourceEmailId: context.sourceEmailId || undefined,
      sourceTicketId: context.ticketId || undefined,
      sourceLeadId: context.leadId || undefined,
      slaDeadline,
      dueDate,
    }).returning();

    return task;
  }

  /**
   * Determine who to assign a task to, based on context
   */
  async determineAssignee(context: {
    taskType: string;
    department: string | null;
    propertyId: number | null;
    leadId: number | null;
    landlordId: number | null;
    tenantId: number | null;
  }): Promise<number | null> {

    // 1. PROPERTY-BASED: If task has a property, assign to its PM or agent
    if (context.propertyId) {
      const [prop] = await db.select({
        propertyManagerId: properties.propertyManagerId,
        agentId: properties.agentId,
      })
        .from(properties)
        .where(eq(properties.id, context.propertyId))
        .limit(1);

      if (prop?.propertyManagerId) return prop.propertyManagerId;
      if (prop?.agentId) return prop.agentId;
    }

    // 2. LEAD-BASED: If task relates to a lead, use the lead's assigned agent
    if (context.leadId) {
      const [lead] = await db.select({ assignedTo: leads.assignedTo })
        .from(leads)
        .where(eq(leads.id, context.leadId))
        .limit(1);

      if (lead?.assignedTo) return lead.assignedTo;
    }

    // 3. LANDLORD-BASED: Find PM of their most recent managed property
    if (context.landlordId) {
      const [prop] = await db.select({
        propertyManagerId: properties.propertyManagerId,
      })
        .from(properties)
        .where(and(
          eq(properties.landlordId, context.landlordId),
          eq(properties.isManaged, true)
        ))
        .orderBy(desc(properties.updatedAt))
        .limit(1);

      if (prop?.propertyManagerId) return prop.propertyManagerId;
    }

    // 4. ASSIGNMENT RULES: Check configurable rules
    const ruleAssignee = await this.checkAssignmentRules(context);
    if (ruleAssignee) return ruleAssignee;

    // 5. DEPARTMENT ROUTING: Based on email department
    if (context.department) {
      const deptAssignee = await this.getDepartmentAssignee(context.department);
      if (deptAssignee) return deptAssignee;
    }

    // 6. TASK TYPE ROUTING
    const typeAssignee = await this.getTaskTypeAssignee(context.taskType);
    if (typeAssignee) return typeAssignee;

    // 7. FALLBACK: Find any admin or general manager
    const [fallback] = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.role, 'admin'))
      .limit(1);

    return fallback?.id || null;
  }

  /**
   * Check configurable assignment rules
   */
  private async checkAssignmentRules(context: {
    taskType: string;
    department: string | null;
  }): Promise<number | null> {
    // Check department rules first, then task type rules
    const matchValues = [
      context.department,
      context.taskType,
    ].filter(Boolean) as string[];

    if (matchValues.length === 0) return null;

    const rules = await db.select()
      .from(assignmentRules)
      .where(and(
        eq(assignmentRules.isActive, true),
        sql`${assignmentRules.matchValue} IN (${sql.join(matchValues.map(v => sql`${v}`), sql`, `)})`
      ))
      .orderBy(desc(assignmentRules.priority))
      .limit(1);

    return rules[0]?.assignedUserId || null;
  }

  /**
   * Get an assignee for a department using round-robin (user with fewest open tasks)
   */
  private async getDepartmentAssignee(department: string): Promise<number | null> {
    // Map department to access level codes
    const deptAccessLevels: Record<string, string[]> = {
      sales: ['sales_lettings_negotiator', 'senior_sales_negotiator', 'general_manager'],
      lettings: ['sales_lettings_negotiator', 'lettings_manager', 'general_manager'],
      maintenance: ['property_manager', 'general_manager'],
    };

    const accessLevels = deptAccessLevels[department];
    if (!accessLevels) return null;

    // Find user with fewest open tasks in the department
    const result = await db.select({
      userId: users.id,
      openTasks: sql<number>`COALESCE((SELECT COUNT(*) FROM task WHERE assigned_to_id = ${users.id} AND status IN ('pending', 'in_progress')), 0)`,
    })
      .from(users)
      .where(and(
        eq(users.role, 'agent'),
        sql`${users.accessLevelCode} IN (${sql.join(accessLevels.map(a => sql`${a}`), sql`, `)})`
      ))
      .orderBy(asc(sql`COALESCE((SELECT COUNT(*) FROM task WHERE assigned_to_id = ${users.id} AND status IN ('pending', 'in_progress')), 0)`))
      .limit(1);

    return result[0]?.userId || null;
  }

  /**
   * Get an assignee based on task type
   */
  private async getTaskTypeAssignee(taskType: string): Promise<number | null> {
    const typeAccessLevels: Record<string, string[]> = {
      maintenance: ['property_manager'],
      viewing: ['sales_lettings_negotiator'],
      enquiry_response: ['sales_lettings_negotiator'],
      document: ['property_manager', 'general_manager'],
    };

    const accessLevels = typeAccessLevels[taskType];
    if (!accessLevels) return null;

    const result = await db.select({ id: users.id })
      .from(users)
      .where(and(
        eq(users.role, 'agent'),
        sql`${users.accessLevelCode} IN (${sql.join(accessLevels.map(a => sql`${a}`), sql`, `)})`
      ))
      .orderBy(asc(sql`COALESCE((SELECT COUNT(*) FROM task WHERE assigned_to_id = ${users.id} AND status IN ('pending', 'in_progress')), 0)`))
      .limit(1);

    return result[0]?.id || null;
  }

  /**
   * Calculate due date based on priority
   */
  calculateDueDate(priority: string, dueWithinHours?: number): Date {
    const hours = dueWithinHours || SLA_HOURS[priority] || 24;
    const due = new Date();
    due.setHours(due.getHours() + hours);
    return due;
  }

  /**
   * Calculate SLA deadline (stricter than due date — used for escalation)
   */
  calculateSlaDeadline(priority: string): Date {
    const hours = SLA_HOURS[priority] || 24;
    const deadline = new Date();
    deadline.setHours(deadline.getHours() + hours);
    return deadline;
  }
}

export const taskAssignmentService = new TaskAssignmentService();
