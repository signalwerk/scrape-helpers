import { baseLogger } from "./SqliteLogger.js";
import { FlowControlError } from "./FlowControlError.js";

// Generic Queue class
export class Queue {
  constructor(name, processors, driver, options = {}) {
    this.name = name;
    this.processors = processors;
    this.driver = driver;
    this.maxConcurrent = options.maxConcurrent || 3;

    this.items = [];
    this.activeCount = 0;
    this.waitingWorkers = [];
  }

  add(item) {
    this.items.push(item);
    this.notifyWorkers();

    const logger = createContextLogger(
      baseLogger,
      { ...item, stage: this.name },
      this.driver.sqliteLogger,
    );
    logger.log(`Added to ${this.name} queue`);
  }

  notifyWorkers() {
    if (this.waitingWorkers.length > 0 && this.items.length > 0) {
      const resolver = this.waitingWorkers.shift();
      resolver();
    }
  }

  async waitForWork() {
    return new Promise((resolve) => {
      this.waitingWorkers.push(resolve);
    });
  }

  async processItem(item) {
    const contextLogger = createContextLogger(
      baseLogger,
      { ...item, stage: this.name },
      this.driver.sqliteLogger,
    );
    contextLogger.log(`Processing ${this.name} pipeline`);

    try {
      let context = { ...item, stage: this.name }; // Create a copy and add stage info

      // Create enhanced context with queue control methods
      const enhancedContext = {
        ...context,
        addToQueue: (queueName, newItem) => {
          const targetQueue = this.driver.queues[queueName];
          if (targetQueue) {
            // Add parent ID to the new item to track relationships
            const itemWithParent = {
              ...newItem,
              parentId: context.id, // Set the current context's ID as parent
            };
            targetQueue.add(itemWithParent);
          } else {
            contextLogger.error(`Queue ${queueName} not found`);
          }
        },
        fail: (reason) => {
          this.driver.failed.add(item.url || item.id);
          // Update SQLite status
          this.driver.sqliteLogger.updateUrlStatus(
            item.url,
            item.normalizedUrl || item.url,
            "failed",
            {
              errorMessage: reason,
              parentId: item.parentId,
            },
          );
          throw new Error(reason);
        },
        complete: () => {
          this.driver.completed.add(item.url || item.id);
          // Update SQLite status
          this.driver.sqliteLogger.updateUrlStatus(
            item.url,
            item.normalizedUrl || item.url,
            "completed",
            {
              statusCode:
                item.response?.status || item.cachedData?.metadata?.status,
              mimeType: item.mimeType,
              redirects: item.redirects || 0,
              fromCache: !!item.cached,
              parentId: item.parentId,
            },
          );
        },
      };

      // Process through all processors
      for (const processor of this.processors) {
        const stepLogger = createContextLogger(
          baseLogger,
          { ...context, stage: this.name },
          this.driver.sqliteLogger,
        );
        const result = await processor(enhancedContext, stepLogger);

        // Update context with results, but preserve enhanced methods
        context = { ...result, stage: this.name };
        Object.assign(enhancedContext, context);
      }

      contextLogger.log(`${this.name} pipeline completed`);
      return context;
    } catch (error) {
      // Handle flow control errors as normal operation, not real errors
      if (error instanceof FlowControlError) {
        contextLogger.log(`${this.name} pipeline stopped: ${error.message}`);
        // Don't mark as failed or log as error - this is normal flow control
        return context;
      }

      // Handle real errors
      contextLogger.error(`${this.name} pipeline failed: ${error.message}`, {
        error: error.message,
      });
      console.error(error);
      this.driver.failed.add(item.url || item.id);

      // Update SQLite status
      this.driver.sqliteLogger.updateUrlStatus(
        item.url,
        item.normalizedUrl || item.url,
        "error",
        {
          errorMessage: error.message,
          statusCode: error.response?.status,
          parentId: item.parentId,
        },
      );

      throw error;
    }
  }

  async worker() {
    while (this.driver.isRunning) {
      if (this.items.length === 0 || this.activeCount >= this.maxConcurrent) {
        await this.waitForWork();
        continue;
      }

      const item = this.items.shift();
      if (!item) continue;

      this.activeCount++;

      this.processItem(item)
        .catch((error) => {
          // Only log if it's not a flow control error
          if (!(error instanceof FlowControlError)) {
            // Real error already logged in processItem
          }
        })
        .finally(() => {
          this.activeCount--;
          this.driver.checkCompletion();
          // Notify workers in case there are more items to process
          this.notifyWorkers();
        });
    }
  }

  getStatus() {
    return {
      queue: this.items.length,
      active: this.activeCount,
    };
  }

  hasWork() {
    return this.items.length > 0 || this.activeCount > 0;
  }
}
// Create a context-aware logger factory

export function createContextLogger(baseLogger, context, sqliteLogger = null) {
  const prefix = context?.id ? `[${context.id}]` : "[no-id]";

  return {
    log: (txt, details = {}) => {
      // Only log to console for non-cache info messages
      if (!txt.includes("using cached data")) {
        baseLogger.log(`${prefix} ${txt}`);
      }

      // Always log to SQLite (but with appropriate level)
      if (sqliteLogger) {
        const level = txt.includes("using cached data") ? "debug" : "info";
        sqliteLogger.logProcessing(
          context?.id,
          context?.url,
          context?.normalizedUrl,
          context?.stage || "unknown",
          level,
          txt,
          {
            ...details,
            fromCache: txt.includes("using cached data"),
            parentId: context?.parentId,
          }
        );
      }
    },
    error: (txt, details = {}) => {
      baseLogger.error(`${prefix} ⚠️ ${txt}`);

      if (sqliteLogger) {
        sqliteLogger.logProcessing(
          context?.id,
          context?.url,
          context?.normalizedUrl,
          context?.stage || "unknown",
          "error",
          txt,
          { ...details, parentId: context?.parentId }
        );
      }
    },
  };
}

