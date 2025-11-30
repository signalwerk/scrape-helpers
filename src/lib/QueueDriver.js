import { Queue } from "./Queue.js";
import { SqliteLogger, baseLogger } from "./SqliteLogger.js";
import { v4 as uuid } from "uuid";

export class QueueDriver {
  constructor(config, options = {}) {
    this.config = config;
    this.isRunning = false;
    this.completed = new Set();
    this.failed = new Set();
    this.completionWaiters = [];
    this.sqliteLogger = new SqliteLogger(options.dbPath || "./scraping.db");

    // Create queues based on config
    this.queues = {};
    for (const [queueName, processors] of Object.entries(config.queues)) {
      this.queues[queueName] = new Queue(queueName, processors, this, {
        maxConcurrent: options.maxConcurrent || 3,
      });
    }
  }

  checkCompletion() {
    if (!this.hasWork()) {
      while (this.completionWaiters.length > 0) {
        const resolver = this.completionWaiters.shift();
        resolver();
      }
    }
  }

  hasWork() {
    return Object.values(this.queues).some((queue) => queue.hasWork());
  }

  async waitForCompletion() {
    while (this.hasWork()) {
      await new Promise((resolve) => {
        this.completionWaiters.push(resolve);
      });
    }
  }

  getStatus() {
    const status = { completed: this.completed.size, failed: this.failed.size };
    for (const [name, queue] of Object.entries(this.queues)) {
      status[name] = queue.getStatus();
    }
    return status;
  }

  async start() {
    if (this.isRunning) {
      throw new Error("Driver is already running");
    }

    this.isRunning = true;

    // Initialize SQLite logger
    await this.sqliteLogger.init();

    baseLogger.log("Starting generalized queue driver...");

    // Add initial items to the first queue
    const firstQueueName = Object.keys(this.queues)[0];
    const firstQueue = this.queues[firstQueueName];

    for (const startItem of this.config.start) {
      const item = {
        ...startItem,
        id: uuid(),
        addedAt: new Date().toISOString(),
        redirects: startItem.redirects || 0,
      };
      firstQueue.add(item);
    }

    // Start all workers
    const workers = [
      ...Object.values(this.queues).map((queue) => queue.worker()),
      this.monitor(),
    ];

    // Wait for completion
    await this.waitForCompletion();

    // Stop workers
    this.isRunning = false;

    // Notify all waiting workers
    Object.values(this.queues).forEach((queue) => {
      while (queue.waitingWorkers.length > 0) {
        const resolver = queue.waitingWorkers.shift();
        resolver();
      }
    });

    await Promise.all(workers);

    baseLogger.log("Queue driver completed");
    await this.printStats();

    // Close database connection
    await this.sqliteLogger.close();
  }

  async monitor() {
    while (this.isRunning) {
      if (this.hasWork()) {
        baseLogger.log(`Queue status: ${JSON.stringify(this.getStatus())}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  async printStats() {
    baseLogger.log("\n=== Final Statistics ===");
    baseLogger.log(`Completed: ${this.completed.size} items`);
    baseLogger.log(`Failed: ${this.failed.size} items`);

    if (this.failed.size > 0) {
      baseLogger.log("Failed items:");
      for (const item of this.failed) {
        baseLogger.log(`  - ${item}`);
      }
    }

    // Use SqliteLogger's unified print methods
    await this.sqliteLogger.printStats(baseLogger);
    await this.sqliteLogger.printFailedUrls(baseLogger);
    await this.sqliteLogger.print404Urls(baseLogger);
  }
}
