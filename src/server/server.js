// server.js
import path from "path";
import { EventEmitter } from "events";
import express from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import { Queue } from "./queue.js";
import { Cache } from "./utils/Cache.js";
import { writeFile } from "./utils/writeFile.js";
import { Tracker } from "./utils/Tracker.js";
import { DataPatcher } from "./utils/DataPatcher.js";

export class WebServer {
  constructor(options = {}) {
    // Initialize configurable components
    this.cache = options.cache || new Cache();
    this.dataPatcher = options.dataPatcher || new DataPatcher();
    this.requestTracker = options.requestTracker || new Tracker();
    this.writeTracker = options.writeTracker || new Tracker();
    this.urls = options.urls;

    // Initialize queues with custom settings
    this.queues = {
      request: new Queue("request", {
        maxConcurrent: options.requestConcurrency || 100,
      }),
      fetch: new Queue("fetch", {
        maxConcurrent: options.fetchConcurrency || 20,
      }),
      parse: new Queue("parse", {
        maxConcurrent: options.parseConcurrency || 100,
      }),
      write: new Queue("write", {
        maxConcurrent: options.writeConcurrency || 50,
      }),
    };

    // Initialize express and socket.io
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new SocketIOServer(this.server);
    this.events = new EventEmitter();

    // Setup middleware
    this.app.use(express.json());

    // Initialize server
    this.setupEventHandlers();
    this.setupRoutes();
    this.setupSocketHandlers();

    return this;
  }

  // Configure queue processors
  configureQueues(processors) {
    if (processors.request) {
      processors.request.forEach((processor) => {
        this.queues.request.use({ processor, context: this });
      });
    }

    if (processors.fetch) {
      processors.fetch.forEach((processor) => {
        this.queues.fetch.use({ processor, context: this });
      });
    }

    if (processors.parse) {
      processors.parse.forEach((processor) => {
        this.queues.parse.use({ processor, context: this });
      });
    }

    if (processors.write) {
      processors.write.forEach((processor) => {
        this.queues.write.use({ processor, context: this });
      });
    }

    return this;
  }

  setupEventHandlers() {
    this.events.on("createRequestJob", (data) => {
      let { cache, ...dataWithoutCache } = data;
      this.queues.request.addJob(dataWithoutCache);
    });

    this.events.on("createFetchJob", (data) => {
      this.queues.fetch.addJob(data);
    });

    this.events.on("createParseJob", (data) => {
      this.queues.parse.addJob(data);
    });

    this.events.on("createWriteJob", (data) => {
      let { cache, ...dataWithoutCache } = data;
      this.queues.write.addJob(dataWithoutCache);
    });
  }

  // Add debounce utility
  debounce(fn, delay) {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  }

  setupRoutes() {
    // show server stats
    this.app.get("/", (req, res) => {
      res.json({
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
      });
    });

    // Stats endpoint
    this.app.get("/api/stats", (req, res) => {
      const stats = {
        request: this.queues.request.getStats(),
        fetch: this.queues.fetch.getStats(),
        parse: this.queues.parse.getStats(),
      };
      res.json(stats);
    });

    // History endpoint
    this.app.get("/api/history", (req, res) => {
      const { status, search, queues, errorFilter, limit = 50 } = req.query;
      const selectedQueues = queues ? queues.split(",") : [];

      const results = {};
      selectedQueues.forEach((queueName) => {
        const queue = this.queues[queueName];
        if (queue) {
          results[queueName] = queue.getFilteredHistory({
            status,
            searchTerm: search,
            errorFilter,
            limit,
          });
        }
      });

      // Combine results using round-robin
      const combined = {
        total: Object.values(results).reduce((sum, r) => sum + r.total, 0),
        jobs: [],
      };

      let remaining = Math.min(
        limit,
        Math.max(...Object.values(results).map((r) => r.jobs.length)),
      );

      while (remaining > 0) {
        for (const queueResults of Object.values(results)) {
          if (queueResults.jobs.length > 0) {
            combined.jobs.push(queueResults.jobs.shift());
          }
        }
        remaining--;
      }

      res.json(combined);
    });

    // Job detail endpoint
    this.app.get("/api/jobs/:id", (req, res) => {
      const job = Object.values(this.queues)
        .map((queue) => queue.getJobById(req.params.id))
        .find((job) => job);

      if (job) {
        res.json(job);
      } else {
        res.status(404).json({ error: "Job not found" });
      }
    });

    // write job history
    this.app.post("/api/history/write", async (req, res) => {
      const { type } = req.body;
      const data = {
        request: this.queues.request.history,
        fetch: this.queues.fetch.history,
        parse: this.queues.parse.history,
        write: this.queues.write.history,
      };

      const baseDir = "./DATA/SOURCE";

      const filePath = path.join(baseDir, "history.json");

      await writeFile(filePath, JSON.stringify(data, null, 2));

      res.json({ success: true });
    });

    // Add job endpoint
    this.app.post("/api/jobs", async (req, res) => {
      const { type } = req.body;

      if (type === "request" || type === "write") {
        const queue = this.queues[type];

        const jobIds = [];
        for (const url of this.urls) {
          const jobId = queue.addJob({ uri: url });
          jobIds.push(jobId);
        }

        this.emitQueueStats();
        res.json({ success: true, jobIds });
      } else {
        return res.status(400).json({ error: "Invalid queue type" });
      }
    });

    // Clear history endpoint
    this.app.post("/api/jobs/clear-history", (req, res) => {
      Object.values(this.queues).forEach((queue) => queue.clearHistory());
      this.requestTracker.clear();
      this.writeTracker.clear();
      this.emitQueueStats();
      res.json({ success: true });
    });

    // Clear cache endpoint
    this.app.post("/api/jobs/clear-cache", (req, res) => {
      this.cache.clear();
      res.json({ success: true });
    });
  }

  setupSocketHandlers() {
    const emitQueueStats = this.debounce(() => {
      const stats = {
        request: this.queues.request.getStats(),
        fetch: this.queues.fetch.getStats(),
        parse: this.queues.parse.getStats(),
        write: this.queues.write.getStats(),
      };
      this.io.emit("queueStats", stats);
      this.io.emit("historyUpdate");
    }, 250);

    // Store reference for use in other methods
    this.emitQueueStats = emitQueueStats;

    // Setup queue event handlers
    Object.values(this.queues).forEach((queue) => {
      queue.events.on("jobAdded", emitQueueStats);
      queue.events.on("jobStarted", emitQueueStats);
      queue.events.on("jobCompleted", emitQueueStats);
      queue.events.on("jobFailed", emitQueueStats);
      queue.events.on("jobProgress", emitQueueStats);
      queue.events.on("jobLog", (job) => {
        this.io.emit("jobUpdate", job);
      });
    });

    // Socket connection handler
    this.io.on("connection", (socket) => {
      console.log("A client connected");
      socket.emit("initialData", {
        request: this.queues.request.getAllJobs(),
        fetch: this.queues.fetch.getAllJobs(),
        parse: this.queues.parse.getAllJobs(),
        write: this.queues.write.getAllJobs(),
      });
    });
  }

  start(port = 3000) {
    return new Promise((resolve) => {
      this.server.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
        resolve();
      });
    });
  }

  stop() {
    return new Promise((resolve) => {
      this.server.close(() => {
        console.log("Server stopped");
        resolve();
      });
    });
  }
}
