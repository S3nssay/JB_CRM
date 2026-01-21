/**
 * Database-backed Job Queue for Email Processing
 *
 * Provides a portable, database-backed job queue that doesn't depend on Redis
 * or cloud-specific services. Uses PostgreSQL with row-level locking for
 * concurrent worker safety.
 */

import { db } from '../../db';
import { emailJobQueue, EmailJob, InsertEmailJob } from '@shared/schema';
import { eq, and, lte, sql, or, isNull } from 'drizzle-orm';

export type JobType =
  | 'process_email'
  | 'send_email'
  | 'sync_folder'
  | 'renew_subscription'
  | 'process_ai';

export interface ProcessEmailPayload {
  graphMessageId: string;
  connectionId: number;
  userId: number;
  notificationId?: string;
}

export interface SendEmailPayload {
  connectionId: number;
  userId: number;
  sentEmailId: number;
}

export interface SyncFolderPayload {
  connectionId: number;
  userId: number;
  folderId: string;
  folderName: string;
}

export interface RenewSubscriptionPayload {
  subscriptionId: number;
  connectionId: number;
}

export interface ProcessAiPayload {
  processedEmailId: number;
  connectionId: number;
  userId: number;
}

export type JobPayload =
  | ProcessEmailPayload
  | SendEmailPayload
  | SyncFolderPayload
  | RenewSubscriptionPayload
  | ProcessAiPayload;

export interface EnqueueOptions {
  priority?: number;
  scheduledFor?: Date;
  maxAttempts?: number;
  idempotencyKey?: string;
}

/**
 * Email Job Queue Service
 */
export class EmailJobQueue {
  /**
   * Enqueues a new job for processing
   */
  async enqueue(
    jobType: JobType,
    payload: JobPayload,
    options: EnqueueOptions = {}
  ): Promise<EmailJob> {
    const {
      priority = 0,
      scheduledFor = new Date(),
      maxAttempts = 3,
      idempotencyKey,
    } = options;

    // Check for existing job with same idempotency key
    if (idempotencyKey) {
      const existing = await db
        .select()
        .from(emailJobQueue)
        .where(eq(emailJobQueue.idempotencyKey, idempotencyKey))
        .limit(1);

      if (existing.length > 0) {
        console.log(`Job with idempotency key ${idempotencyKey} already exists, skipping`);
        return existing[0];
      }
    }

    const jobData: InsertEmailJob = {
      jobType,
      payload,
      priority,
      scheduledFor,
      maxAttempts,
      idempotencyKey,
      status: 'pending',
      attempts: 0,
      connectionId: (payload as any).connectionId || null,
      userId: (payload as any).userId || null,
    };

    const [job] = await db.insert(emailJobQueue).values(jobData).returning();

    console.log(`Enqueued job ${job.id}: ${jobType}`);
    return job;
  }

  /**
   * Fetches and locks the next available job for processing.
   * Uses SELECT FOR UPDATE SKIP LOCKED for concurrent worker safety.
   */
  async fetchNextJob(workerTypes?: JobType[]): Promise<EmailJob | null> {
    const now = new Date();

    // Build the query conditions
    const conditions = [
      eq(emailJobQueue.status, 'pending'),
      lte(emailJobQueue.scheduledFor, now),
    ];

    // Use raw SQL for the FOR UPDATE SKIP LOCKED pattern
    const result = await db.execute(sql`
      UPDATE ${emailJobQueue}
      SET
        status = 'processing',
        started_at = NOW(),
        attempts = attempts + 1,
        updated_at = NOW()
      WHERE id = (
        SELECT id FROM ${emailJobQueue}
        WHERE status = 'pending'
          AND scheduled_for <= NOW()
          ${workerTypes?.length ? sql`AND job_type = ANY(${workerTypes})` : sql``}
        ORDER BY priority DESC, scheduled_for ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `);

    if (result.rows && result.rows.length > 0) {
      return result.rows[0] as EmailJob;
    }

    return null;
  }

  /**
   * Marks a job as completed successfully
   */
  async completeJob(jobId: number, result?: any): Promise<void> {
    await db
      .update(emailJobQueue)
      .set({
        status: 'completed',
        completedAt: new Date(),
        result: result || null,
        updatedAt: new Date(),
      })
      .where(eq(emailJobQueue.id, jobId));

    console.log(`Job ${jobId} completed successfully`);
  }

  /**
   * Marks a job as failed
   */
  async failJob(jobId: number, error: Error, maxAttempts: number = 3): Promise<void> {
    // Get current job to check attempts
    const [job] = await db
      .select()
      .from(emailJobQueue)
      .where(eq(emailJobQueue.id, jobId));

    if (!job) {
      console.error(`Job ${jobId} not found when trying to mark as failed`);
      return;
    }

    const newStatus = job.attempts >= maxAttempts ? 'dead' : 'failed';

    // If not dead, calculate exponential backoff for retry
    let scheduledFor: Date | undefined;
    if (newStatus === 'failed') {
      // Exponential backoff: 30s, 2m, 8m, 32m, etc.
      const backoffSeconds = Math.pow(4, job.attempts) * 30;
      const maxBackoffSeconds = 60 * 60; // Max 1 hour
      const actualBackoff = Math.min(backoffSeconds, maxBackoffSeconds);
      scheduledFor = new Date(Date.now() + actualBackoff * 1000);
    }

    await db
      .update(emailJobQueue)
      .set({
        status: newStatus === 'failed' ? 'pending' : 'dead', // Reset to pending for retry
        error: error.message,
        errorStack: error.stack,
        scheduledFor: scheduledFor,
        updatedAt: new Date(),
      })
      .where(eq(emailJobQueue.id, jobId));

    if (newStatus === 'dead') {
      console.error(`Job ${jobId} moved to dead letter queue after ${job.attempts} attempts`);
    } else {
      console.warn(`Job ${jobId} failed (attempt ${job.attempts}), scheduled for retry at ${scheduledFor}`);
    }
  }

  /**
   * Gets jobs by status
   */
  async getJobsByStatus(
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'dead',
    limit: number = 100
  ): Promise<EmailJob[]> {
    return db
      .select()
      .from(emailJobQueue)
      .where(eq(emailJobQueue.status, status))
      .orderBy(sql`${emailJobQueue.createdAt} DESC`)
      .limit(limit);
  }

  /**
   * Gets job statistics
   */
  async getStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    dead: number;
  }> {
    const result = await db.execute(sql`
      SELECT
        status,
        COUNT(*)::int as count
      FROM ${emailJobQueue}
      GROUP BY status
    `);

    const stats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      dead: 0,
    };

    for (const row of result.rows as any[]) {
      if (row.status in stats) {
        stats[row.status as keyof typeof stats] = row.count;
      }
    }

    return stats;
  }

  /**
   * Cleans up old completed jobs
   */
  async cleanupOldJobs(olderThanDays: number = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await db
      .delete(emailJobQueue)
      .where(
        and(
          eq(emailJobQueue.status, 'completed'),
          lte(emailJobQueue.completedAt, cutoffDate)
        )
      )
      .returning({ id: emailJobQueue.id });

    console.log(`Cleaned up ${result.length} old completed jobs`);
    return result.length;
  }

  /**
   * Recovers stale processing jobs (jobs that have been processing for too long)
   */
  async recoverStaleJobs(staleMinutes: number = 30): Promise<number> {
    const cutoffTime = new Date(Date.now() - staleMinutes * 60 * 1000);

    const result = await db
      .update(emailJobQueue)
      .set({
        status: 'pending',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(emailJobQueue.status, 'processing'),
          lte(emailJobQueue.startedAt, cutoffTime)
        )
      )
      .returning({ id: emailJobQueue.id });

    if (result.length > 0) {
      console.warn(`Recovered ${result.length} stale jobs`);
    }

    return result.length;
  }

  /**
   * Retries a dead job
   */
  async retryDeadJob(jobId: number): Promise<void> {
    await db
      .update(emailJobQueue)
      .set({
        status: 'pending',
        attempts: 0,
        error: null,
        errorStack: null,
        scheduledFor: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(emailJobQueue.id, jobId),
          eq(emailJobQueue.status, 'dead')
        )
      );

    console.log(`Dead job ${jobId} queued for retry`);
  }

  /**
   * Cancels a pending job
   */
  async cancelJob(jobId: number): Promise<boolean> {
    const result = await db
      .delete(emailJobQueue)
      .where(
        and(
          eq(emailJobQueue.id, jobId),
          eq(emailJobQueue.status, 'pending')
        )
      )
      .returning({ id: emailJobQueue.id });

    return result.length > 0;
  }
}

// Export singleton instance
export const emailJobQueue = new EmailJobQueue();
