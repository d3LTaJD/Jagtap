const QueueJob = require('../models/QueueJob');
const SystemAuditLog = require('../models/SystemAuditLog');
const Metrics = require('../models/Metrics');

const handlers = {};
let isWorkerRunning = false;
let workerIntervalId = null;
let recoveryIntervalId = null;

class Queue {
  constructor(queueName) {
    this.queueName = queueName;
  }

  /**
   * Adds a new job to the queue database table.
   * @param {Object} payload - Payload data for the job
   * @param {Object} options - Custom options e.g. { maxAttempts: 3 }
   * @returns {Promise<Object>} The created QueueJob document
   */
  async add(payload, options = {}) {
    const maxAttempts = options.maxAttempts || 3;
    const job = await QueueJob.create({
      queueName: this.queueName,
      payload,
      maxAttempts,
      status: 'Pending'
    });
    
    // Log event in SystemAuditLog
    await SystemAuditLog.create({
      eventType: 'QUEUE_EXECUTION',
      entityType: 'QueueJob',
      entityId: job._id,
      action: `Job added to ${this.queueName}`,
      metadata: { queueName: this.queueName, jobId: job._id }
    });

    console.log(`[Queue] Added job ${job._id} to ${this.queueName}`);
    return job;
  }
}

/**
 * Registers a handler callback function for a queue name.
 * @param {string} queueName 
 * @param {Function} handlerFn 
 */
function registerHandler(queueName, handlerFn) {
  handlers[queueName] = handlerFn;
}

/**
 * Sweeps the database for stuck Processing jobs (longer than 5 minutes lock) and resets them.
 */
async function recoverCrashedJobs() {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  try {
    const stuckJobs = await QueueJob.find({
      status: 'Processing',
      lockedAt: { $lt: fiveMinutesAgo }
    });

    if (stuckJobs.length > 0) {
      console.log(`[Queue Service] Found ${stuckJobs.length} stuck jobs locked before ${fiveMinutesAgo}. Recovering to Pending...`);
      for (const job of stuckJobs) {
        job.status = 'Pending';
        job.lockedBy = null;
        job.lockedAt = null;
        job.nextRetryAt = null;
        job.errorLogs.push({
          message: 'Lock timeout exceeded. Reset to Pending by recovery sweep.',
          stack: 'Automatic crash recovery trigger.'
        });
        await job.save();

        await SystemAuditLog.create({
          eventType: 'QUEUE_EXECUTION',
          entityType: 'QueueJob',
          entityId: job._id,
          action: `Job lock timeout exceeded in ${job.queueName}. Recovered to Pending.`,
          metadata: { queueName: job.queueName, jobId: job._id }
        });
      }
    }
  } catch (err) {
    console.error('[Queue Service] Error recovering stuck jobs:', err.message);
  }
}

/**
 * Background worker loop that pulls and processes the next pending job.
 */
async function processJobs() {
  if (isWorkerRunning) return;
  isWorkerRunning = true;

  let job = null;
  try {
    const workerId = `worker-${process.pid}`;
    
    // Atomic update to lock and acquire the next pending job
    job = await QueueJob.findOneAndUpdate(
      { 
        status: 'Pending',
        $or: [
          { nextRetryAt: null },
          { nextRetryAt: { $lte: new Date() } }
        ]
      },
      { 
        status: 'Processing', 
        lockedBy: workerId,
        lockedAt: new Date(),
        startedAt: new Date() 
      },
      { new: true, sort: { createdAt: 1 } }
    );

    if (!job) {
      isWorkerRunning = false;
      return;
    }

    console.log(`[Worker] Started processing job ${job._id} in ${job.queueName} (Attempt ${job.attempts + 1}/${job.maxAttempts})`);
    
    // Log to SystemAuditLog
    await SystemAuditLog.create({
      eventType: 'QUEUE_EXECUTION',
      entityType: 'QueueJob',
      entityId: job._id,
      action: `Processing job in ${job.queueName}`,
      metadata: { queueName: job.queueName, attempt: job.attempts + 1 }
    });

    const handler = handlers[job.queueName];
    if (!handler) {
      throw new Error(`No registered handler for queue: ${job.queueName}`);
    }

    // Increment attempts count
    job.attempts += 1;
    await job.save();

    // Run handler (payload and data are kept in sync via schema hooks)
    await handler(job.payload || job.data);

    // Job completed successfully
    job.status = 'Completed';
    job.completedAt = new Date();
    job.lockedBy = null;
    job.lockedAt = null;
    job.nextRetryAt = null;
    await job.save();

    // Track Queue Processing Latency metric
    const latency = Date.now() - job.createdAt;
    await Metrics.create({
      metricName: 'QueueLatency',
      value: latency,
      metadata: { queueName: job.queueName, jobId: job._id }
    }).catch(mErr => console.error('[Queue Service] Failed to log latency metric:', mErr.message));

    // Track success rate metrics depending on queue name
    if (job.queueName === 'OCRProcessingQueue') {
      await Metrics.create({ metricName: 'OcrSuccessRate', value: 1 }).catch(() => {});
    } else if (job.queueName === 'AIExtractionQueue') {
      await Metrics.create({ metricName: 'AiSuccessRate', value: 1 }).catch(() => {});
    }

    console.log(`[Worker] Job ${job._id} in ${job.queueName} completed successfully`);

    await SystemAuditLog.create({
      eventType: 'QUEUE_EXECUTION',
      entityType: 'QueueJob',
      entityId: job._id,
      action: `Job completed in ${job.queueName}`,
      metadata: { queueName: job.queueName }
    });

  } catch (err) {
    console.error(`[Worker] Job failed: ${err.message}`, err.stack);
    
    if (job) {
      // Reload job to avoid overwriting database changes
      const failedJob = await QueueJob.findById(job._id);
      if (failedJob) {
        failedJob.errorLogs.push({
          message: err.message,
          stack: err.stack
        });
        failedJob.lastError = err.message;

        // Log failure rates
        if (failedJob.queueName === 'OCRProcessingQueue') {
          await Metrics.create({ metricName: 'OcrSuccessRate', value: 0 }).catch(() => {});
        } else if (failedJob.queueName === 'AIExtractionQueue') {
          await Metrics.create({ metricName: 'AiSuccessRate', value: 0 }).catch(() => {});
        }

        const isRetryable = !err.nonRetryable;
        if (isRetryable && failedJob.attempts < failedJob.maxAttempts) {
          // Schedule retry (putting back into Pending status, releasing lock, exponential retry backoff)
          failedJob.status = 'Pending';
          failedJob.lockedBy = null;
          failedJob.lockedAt = null;
          const retryDelaySeconds = Math.pow(2, failedJob.attempts) * 10; // 10s, 20s, 40s retry backoff
          failedJob.nextRetryAt = new Date(Date.now() + retryDelaySeconds * 1000);
          console.log(`[Worker] Job ${failedJob._id} in ${failedJob.queueName} scheduled for retry at ${failedJob.nextRetryAt}`);
        } else {
          // Final failure -> Dead Letter Queue (Failed)
          failedJob.status = 'Failed';
          failedJob.failedAt = new Date();
          failedJob.lockedBy = null;
          failedJob.lockedAt = null;
          failedJob.nextRetryAt = null;
          console.error(`[Worker] Job ${failedJob._id} in ${failedJob.queueName} failed permanently after ${failedJob.attempts} attempts`);

          // Log final failure in SystemAuditLog
          await SystemAuditLog.create({
            eventType: 'QUEUE_EXECUTION',
            entityType: 'QueueJob',
            entityId: failedJob._id,
            action: `Job permanently failed in ${failedJob.queueName}`,
            metadata: { queueName: failedJob.queueName, error: err.message }
          });

          // Trigger notification and review task for failures
          await handleJobFailureNotification(failedJob, err);
        }
        await failedJob.save();
      }
    }
  } finally {
    isWorkerRunning = false;
    // Schedule check for next job immediately
    setImmediate(processJobs);
  }
}

/**
 * Handles generating alerts/tasks when background queue jobs permanently fail.
 */
async function handleJobFailureNotification(job, err) {
  try {
    const User = require('../models/User');
    const Task = require('../models/Task');
    const { createNotification } = require('./notificationService');

    const admin = await User.findOne({ is_active: true, role: { $in: ['SUPER_ADMIN', 'DIRECTOR', 'SA', 'DIR'] } }) || await User.findOne({ is_active: true });
    if (admin) {
      const title = `❌ Background Job Failed: ${job.queueName}`;
      const message = `Job failed: ${err.message}. Failed permanently after ${job.attempts} attempts. Check admin logs.`;

      const payloadStr = JSON.stringify(job.payload || job.data || {});
      const cleanPayload = payloadStr.length > 250 ? payloadStr.substring(0, 247) + '...' : payloadStr;
      const cleanStack = (err.stack || '').substring(0, 350);

      await Task.create({
        title: title,
        description: `Job ID: ${job._id}\nQueue: ${job.queueName}\nPayload: ${cleanPayload}\nError: ${err.message}\nStack: ${cleanStack}`.substring(0, 950),
        dueDate: new Date(),
        priority: 'High',
        status: 'To Do',
        assignedTo: admin._id,
        createdBy: admin._id
      });

      await createNotification({
        user_id: admin._id,
        type: 'PROCESSING_FAILED',
        title: title,
        message: message,
        related_id: job._id
      });
    }
  } catch (error) {
    console.error('[Queue Service] Error sending failure notification:', error.message);
  }
}

/**
 * Starts polling worker
 */
function startQueueWorker() {
  if (workerIntervalId) return;
  console.log('[Queue Service] Starting background job worker polling...');
  
  // Run recovery sweep immediately on startup
  recoverCrashedJobs().catch(err => console.error('[Queue Service] Error in initial crash recovery sweep:', err));
  
  // Run polling check every 1 second
  workerIntervalId = setInterval(processJobs, 1000);

  // Sweep stuck/crashed processing jobs every 1 minute
  recoveryIntervalId = setInterval(() => {
    recoverCrashedJobs().catch(err => console.error('[Queue Service] Error in periodic crash recovery sweep:', err));
  }, 60000);
}

/**
 * Stops polling worker
 */
function stopQueueWorker() {
  if (workerIntervalId) {
    clearInterval(workerIntervalId);
    workerIntervalId = null;
    console.log('[Queue Service] Background job worker polling stopped.');
  }
  if (recoveryIntervalId) {
    clearInterval(recoveryIntervalId);
    recoveryIntervalId = null;
    console.log('[Queue Service] Background recovery worker stopped.');
  }
}

module.exports = {
  Queue,
  registerHandler,
  startQueueWorker,
  stopQueueWorker,
  processJobs,
  recoverCrashedJobs
};
