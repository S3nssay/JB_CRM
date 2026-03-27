/**
 * Email Worker Process
 *
 * Standalone worker that processes email jobs from the queue.
 * Can run as a separate process or container for scalability.
 *
 * Usage:
 *   npx tsx server/workers/emailWorker.ts
 *   or
 *   node dist/workers/emailWorker.js
 */

import dotenv from 'dotenv';
dotenv.config();

import { EmailJobQueue, JobType, ProcessEmailPayload, SendEmailPayload, RenewSubscriptionPayload } from '../services/email/jobQueue';
import { emailProcessor } from '../services/email/emailProcessor';
import { subscriptionManager } from '../services/email/subscriptionManager';
import { emailSender } from '../services/email/emailSender';

// Configuration
const POLL_INTERVAL_MS = parseInt(process.env.EMAIL_WORKER_POLL_INTERVAL || '5000', 10);
const MAX_CONCURRENT_JOBS = parseInt(process.env.EMAIL_WORKER_MAX_CONCURRENT || '5', 10);
const STALE_JOB_RECOVERY_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

// Worker state
let isRunning = false;
let activeJobs = 0;
const jobQueue = new EmailJobQueue();

/**
 * Processes a single job based on its type
 */
async function processJob(job: any): Promise<void> {
  const { id, jobType, payload } = job;

  console.log(`Processing job ${id} (${jobType})`);

  switch (jobType as JobType) {
    case 'process_email': {
      const emailPayload = payload as ProcessEmailPayload;
      const result = await emailProcessor.processEmail(
        emailPayload.graphMessageId,
        emailPayload.connectionId,
        emailPayload.userId
      );
      if (!result.success) {
        throw new Error(result.error || 'Email processing failed');
      }
      break;
    }

    case 'send_email': {
      const sendPayload = payload as SendEmailPayload;
      const result = await emailSender.sendQueuedEmail(sendPayload.sentEmailId);
      if (!result.success) {
        throw new Error(result.error || 'Email sending failed');
      }
      break;
    }

    case 'renew_subscription': {
      const renewPayload = payload as RenewSubscriptionPayload;
      const result = await subscriptionManager.renewSubscription(renewPayload.subscriptionId);
      if (!result.success) {
        throw new Error(result.error || 'Subscription renewal failed');
      }
      break;
    }

    case 'sync_folder': {
      // Folder sync is handled by a dedicated sync process
      console.log(`Folder sync job ${id} - delegating to sync service`);
      break;
    }

    case 'process_ai': {
      // AI processing is typically done inline with email processing
      // But can be split out for heavy workloads
      console.log(`AI processing job ${id} - inline processing`);
      break;
    }

    default:
      console.warn(`Unknown job type: ${jobType}`);
  }
}

/**
 * Worker loop - fetches and processes jobs
 */
async function workerLoop(): Promise<void> {
  while (isRunning) {
    try {
      // Check if we can take more jobs
      if (activeJobs >= MAX_CONCURRENT_JOBS) {
        await sleep(100);
        continue;
      }

      // Fetch next job
      const job = await jobQueue.fetchNextJob();

      if (!job) {
        // No jobs available, wait before polling again
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      // Process job asynchronously
      activeJobs++;
      processJobWithRetry(job)
        .finally(() => {
          activeJobs--;
        });

    } catch (error) {
      console.error('Error in worker loop:', error);
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

/**
 * Processes a job with error handling and retry logic
 */
async function processJobWithRetry(job: any): Promise<void> {
  try {
    await processJob(job);
    await jobQueue.completeJob(job.id, { processedAt: new Date().toISOString() });
  } catch (error) {
    console.error(`Job ${job.id} failed:`, error);
    await jobQueue.failJob(job.id, error instanceof Error ? error : new Error(String(error)), job.maxAttempts);
  }
}

/**
 * Periodically recovers stale jobs
 */
async function staleJobRecoveryLoop(): Promise<void> {
  while (isRunning) {
    try {
      const recovered = await jobQueue.recoverStaleJobs(30);
      if (recovered > 0) {
        console.log(`Recovered ${recovered} stale jobs`);
      }
    } catch (error) {
      console.error('Error recovering stale jobs:', error);
    }
    await sleep(STALE_JOB_RECOVERY_INTERVAL_MS);
  }
}

/**
 * Periodically cleans up old completed jobs
 */
async function cleanupLoop(): Promise<void> {
  while (isRunning) {
    try {
      const cleaned = await jobQueue.cleanupOldJobs(7);
      if (cleaned > 0) {
        console.log(`Cleaned up ${cleaned} old jobs`);
      }
    } catch (error) {
      console.error('Error cleaning up old jobs:', error);
    }
    await sleep(CLEANUP_INTERVAL_MS);
  }
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Graceful shutdown handler
 */
async function shutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}, shutting down gracefully...`);
  isRunning = false;

  // Wait for active jobs to complete (max 30 seconds)
  const maxWait = 30000;
  const startTime = Date.now();

  while (activeJobs > 0 && Date.now() - startTime < maxWait) {
    console.log(`Waiting for ${activeJobs} active jobs to complete...`);
    await sleep(1000);
  }

  if (activeJobs > 0) {
    console.warn(`Forcing shutdown with ${activeJobs} jobs still running`);
  }

  console.log('Worker shutdown complete');
  process.exit(0);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.log('=================================');
  console.log('Email Worker Starting');
  console.log(`Poll interval: ${POLL_INTERVAL_MS}ms`);
  console.log(`Max concurrent jobs: ${MAX_CONCURRENT_JOBS}`);
  console.log('=================================');

  // Register shutdown handlers
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  isRunning = true;

  // Start worker loops
  Promise.all([
    workerLoop(),
    staleJobRecoveryLoop(),
    cleanupLoop(),
  ]).catch((error) => {
    console.error('Fatal worker error:', error);
    process.exit(1);
  });

  // Log stats periodically
  setInterval(async () => {
    try {
      const stats = await jobQueue.getStats();
      console.log(`Job stats - Pending: ${stats.pending}, Processing: ${stats.processing}, Completed: ${stats.completed}, Failed: ${stats.failed}, Dead: ${stats.dead}`);
    } catch (error) {
      console.error('Error getting stats:', error);
    }
  }, 60000);
}

// Run if this is the main module
main().catch((error) => {
  console.error('Failed to start worker:', error);
  process.exit(1);
});

export { main as startEmailWorker };
