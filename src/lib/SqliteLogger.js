import sqlite3 from "sqlite3";
import { promisify } from "util";
import fs from "fs";
import path from "path";

export const baseLogger = {
  log: (txt) => console.log(txt),
  error: (txt) => console.error(txt),
};
export class SqliteLogger {
  constructor(dbPath = "./scraping.db") {
    this.dbPath = dbPath;
    this.db = null;
    this.isInitialized = false;
  }

  async init() {
    if (this.isInitialized) return;

    // Ensure directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Initialize database
    this.db = new sqlite3.Database(this.dbPath);

    // Promisify database methods
    this.run = promisify(this.db.run.bind(this.db));
    this.get = promisify(this.db.get.bind(this.db));
    this.all = promisify(this.db.all.bind(this.db));

    // Create tables
    await this.createTables();
    this.isInitialized = true;
  }

  async createTables() {
    // Main processing log
    await this.run(`
      CREATE TABLE IF NOT EXISTS processing_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        context_id TEXT,
        parent_id TEXT,
        url TEXT,
        normalized_url TEXT,
        stage TEXT,
        level TEXT,
        message TEXT,
        error_details TEXT,
        status_code INTEGER,
        mime_type TEXT,
        redirects INTEGER,
        from_cache BOOLEAN,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Summary table for quick queries
    await this.run(`
      CREATE TABLE IF NOT EXISTS url_status (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT UNIQUE,
        normalized_url TEXT,
        parent_id TEXT,
        final_status TEXT,
        status_code INTEGER,
        error_message TEXT,
        mime_type TEXT,
        redirects INTEGER,
        from_cache BOOLEAN,
        completed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indices for better performance
    await this.run(
      "CREATE INDEX IF NOT EXISTS idx_processing_log_url ON processing_log(url)",
    );
    await this.run(
      "CREATE INDEX IF NOT EXISTS idx_processing_log_level ON processing_log(level)",
    );
    await this.run(
      "CREATE INDEX IF NOT EXISTS idx_processing_log_stage ON processing_log(stage)",
    );
    await this.run(
      "CREATE INDEX IF NOT EXISTS idx_processing_log_parent_id ON processing_log(parent_id)",
    );
    await this.run(
      "CREATE INDEX IF NOT EXISTS idx_url_status_final_status ON url_status(final_status)",
    );
    await this.run(
      "CREATE INDEX IF NOT EXISTS idx_url_status_status_code ON url_status(status_code)",
    );
    await this.run(
      "CREATE INDEX IF NOT EXISTS idx_url_status_parent_id ON url_status(parent_id)",
    );
  }

  async logProcessing(
    contextId,
    url,
    normalizedUrl,
    stage,
    level,
    message,
    details = {},
  ) {
    if (!this.isInitialized) await this.init();

    const logEntry = {
      timestamp: new Date().toISOString(),
      context_id: contextId,
      parent_id: details.parentId || null,
      url: url,
      normalized_url: normalizedUrl,
      stage: stage,
      level: level,
      message: message,
      error_details: details.error ? JSON.stringify(details.error) : null,
      status_code: details.statusCode || null,
      mime_type: details.mimeType || null,
      redirects: details.redirects || 0,
      from_cache: details.fromCache || false,
    };

    await this.run(
      `
      INSERT INTO processing_log 
      (timestamp, context_id, parent_id, url, normalized_url, stage, level, message, error_details, status_code, mime_type, redirects, from_cache)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        logEntry.timestamp,
        logEntry.context_id,
        logEntry.parent_id,
        logEntry.url,
        logEntry.normalized_url,
        logEntry.stage,
        logEntry.level,
        logEntry.message,
        logEntry.error_details,
        logEntry.status_code,
        logEntry.mime_type,
        logEntry.redirects,
        logEntry.from_cache,
      ],
    );

    // Auto-update url_status for errors to ensure consistency
    if (level === "error") {
      await this.updateUrlStatus(url, normalizedUrl, "error", {
        parentId: details.parentId,
        statusCode: details.statusCode,
        errorMessage: message,
        mimeType: details.mimeType,
        redirects: details.redirects,
        fromCache: details.fromCache,
      });
    }
  }

  async updateUrlStatus(url, normalizedUrl, status, details = {}) {
    if (!this.isInitialized) await this.init();

    await this.run(
      `
      INSERT OR REPLACE INTO url_status 
      (url, normalized_url, parent_id, final_status, status_code, error_message, mime_type, redirects, from_cache, completed_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        url,
        normalizedUrl,
        details.parentId || null,
        status,
        details.statusCode || null,
        details.errorMessage || null,
        details.mimeType || null,
        details.redirects || 0,
        details.fromCache || false,
        new Date().toISOString(),
        new Date().toISOString(),
      ],
    );
  }

  // Query methods for analysis
  async getFailedUrls() {
    if (!this.isInitialized) await this.init();

    return await this.all(`
      SELECT * FROM url_status 
      WHERE final_status IN ('error', 'failed') 
      ORDER BY updated_at DESC
    `);
  }

  async get404Urls() {
    if (!this.isInitialized) await this.init();

    return await this.all(`
      SELECT * FROM url_status 
      WHERE status_code = 404 
      ORDER BY updated_at DESC
    `);
  }

  async getErrorsByStage() {
    if (!this.isInitialized) await this.init();

    return await this.all(`
      SELECT stage, COUNT(*) as error_count 
      FROM processing_log 
      WHERE level = 'error' 
      GROUP BY stage 
      ORDER BY error_count DESC
    `);
  }

  async getProcessingErrors() {
    if (!this.isInitialized) await this.init();

    return await this.all(`
      SELECT * FROM processing_log 
      WHERE level = 'error' 
      ORDER BY timestamp DESC
    `);
  }

  async getUrlHierarchy() {
    if (!this.isInitialized) await this.init();

    return await this.all(`
      SELECT 
        u1.url as parent_url,
        u1.normalized_url as parent_normalized_url,
        u2.url as child_url,
        u2.normalized_url as child_normalized_url,
        u2.final_status as child_status,
        u2.status_code as child_status_code
      FROM url_status u1
      JOIN url_status u2 ON u1.url = (
        SELECT pl.url FROM processing_log pl WHERE pl.context_id = u2.parent_id LIMIT 1
      )
      WHERE u2.parent_id IS NOT NULL
      ORDER BY u1.updated_at, u2.updated_at
    `);
  }

  async getChildUrls(parentId) {
    if (!this.isInitialized) await this.init();

    return await this.all(
      `
      SELECT * FROM url_status 
      WHERE parent_id = ? 
      ORDER BY updated_at
    `,
      [parentId],
    );
  }

  async getStats() {
    if (!this.isInitialized) await this.init();

    const stats = await this.get(`
      SELECT 
        COUNT(*) as total_urls,
        SUM(CASE WHEN final_status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN final_status = 'error' THEN 1 ELSE 0 END) as errors,
        SUM(CASE WHEN final_status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status_code = 404 THEN 1 ELSE 0 END) as not_found,
        SUM(CASE WHEN from_cache = 1 THEN 1 ELSE 0 END) as from_cache
      FROM url_status
    `);

    const errorsByStage = await this.getErrorsByStage();

    return {
      ...stats,
      errorsByStage,
    };
  }

  // Unified stats printing for consistent output
  async printStats(logger = console) {
    const stats = await this.getStats();

    logger.log("\n=== Database Statistics ===");
    logger.log(`Total URLs processed: ${stats.total_urls}`);
    logger.log(`Completed: ${stats.completed}`);
    logger.log(`Failed URLs: ${stats.errors}`);
    logger.log(`Failed: ${stats.failed}`);
    logger.log(`404 Not Found: ${stats.not_found}`);
    logger.log(`From Cache: ${stats.from_cache}`);

    if (stats.errorsByStage && stats.errorsByStage.length > 0) {
      logger.log("\n=== Processing Errors by Stage ===");
      for (const errorStat of stats.errorsByStage) {
        logger.log(`${errorStat.stage}: ${errorStat.error_count}`);
      }
    }
  }

  async printFailedUrls(logger = console, limit = 10) {
    const failedUrls = await this.getFailedUrls();
    if (failedUrls.length > 0) {
      logger.log("\n=== Failed URLs ===");
      for (const failed of failedUrls.slice(0, limit)) {
        logger.log(
          `${failed.url} - Status: ${failed.status_code || "unknown"} - Error: ${failed.error_message || "no message"}`,
        );
        if (failed.parent_id) {
          logger.log(`  ↳ Initiated by parent ID: ${failed.parent_id}`);
        }
      }
      if (failedUrls.length > limit) {
        logger.log(`  ... and ${failedUrls.length - limit} more`);
      }
    }
  }

  async print404Urls(logger = console, limit = 10) {
    const notFoundUrls = await this.get404Urls();
    if (notFoundUrls.length > 0) {
      logger.log("\n=== 404 Not Found URLs ===");
      for (const notFound of notFoundUrls.slice(0, limit)) {
        logger.log(notFound.url);
        if (notFound.parent_id) {
          logger.log(`  ↳ Initiated by parent ID: ${notFound.parent_id}`);
        }
      }
      if (notFoundUrls.length > limit) {
        logger.log(`  ... and ${notFoundUrls.length - limit} more`);
      }
    }
  }

  async printProcessingErrors(logger = console) {
    const errors = await this.getProcessingErrors();
    if (errors.length > 0) {
      logger.log("\n=== Processing Errors ===");
      for (const error of errors) {
        logger.log(
          `[${error.timestamp}] ${error.stage} - ${error.url}: ${error.message}`,
        );
        if (error.error_details) {
          logger.log(`  Details: ${error.error_details}`);
        }
        if (error.parent_id) {
          logger.log(`  Parent ID: ${error.parent_id}`);
        }
        logger.log("");
      }
    }
  }

  async printUrlHierarchy(logger = console, limit = 20) {
    const hierarchy = await this.getUrlHierarchy();
    if (hierarchy.length > 0) {
      logger.log("\n=== URL Hierarchy (Parent -> Child relationships) ===");
      for (const rel of hierarchy.slice(0, limit)) {
        logger.log(
          `${rel.parent_url} -> ${rel.child_url} (${rel.child_status})`,
        );
      }
      if (hierarchy.length > limit) {
        logger.log(`... and ${hierarchy.length - limit} more relationships`);
      }
    } else {
      logger.log("No parent-child relationships found");
    }
  }

  async close() {
    if (this.db) {
      await new Promise((resolve, reject) => {
        this.db.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }
}
