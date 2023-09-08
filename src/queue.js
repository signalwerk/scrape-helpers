import fs from "fs";
import path from "path";
import util from "util";
import cliProgress from "cli-progress";
import { EventEmitter } from "events";
import { processFile } from "./queue/process.js";
import { download } from "./queue/download.js";

const readFile = util.promisify(fs.readFile);

const eventEmitter = new EventEmitter();

export async function queue({
  toDownload,
  typesToDownload,
  downloadDir,
  allowDomains,
  disallowDomains,
  downloadedFile,
  logFile,
  searchParameters,
  rejectRegex,
  includeRegex,
  postProcess,
  process,
}) {
  eventEmitter.on("finish", async () => {
    const bar1 = new cliProgress.SingleBar(
      {
        clearOnComplete: false,
        hideCursor: true,
        format:
          "  post process    {bar}  {percentage}% || {value}/{total} Files",
      },
      cliProgress.Presets.shades_classic
    );

    bar1.start(Object.keys(downloadedUrls).length, 0);

    // Wait for 2 seconds
    await new Promise((resolve) => setTimeout(resolve, 2000));

    for (const [key, value] of Object.entries(downloadedUrls)) {
      bar1.increment();

      const item = downloadedUrls[key];

      appendToLog(`START postprocess: ${key}`);

      if (
        postProcess["text/html"] &&
        item.status !== "error" &&
        item.mimeType === "text/html"
      ) {
        fs.copyFileSync(item.path, `${item.path}.orig`);

        appendToLog(`START postprocess text/html`);

        postProcess["text/html"]({
          appendToLog,
          downloadedFile: item,
          downloadedFiles: downloadedUrls,
        });
      }

      if (
        postProcess["text/css"] &&
        item.status !== "error" &&
        item.mimeType === "text/css"
      ) {
        fs.copyFileSync(item.path, `${item.path}.orig`);

        appendToLog(`START postprocess text/css`);

        await postProcess["text/css"]({
          appendToLog,
          downloadedFile: item,
          downloadedFiles: downloadedUrls,
        });
      }
    }

    bar1.stop();
  });

  eventEmitter.on("newDownload", async () => {
    await download({
      typesToDownload,
      appendToLog,
      downloadQueue,
      processedUrls,
      downloadProgress,
      processQueue,
      processProgress,
      downloadDir,
      downloadedFile,
      // Pass the semaphore as a parameter to the download function
      downloadedUrls,
      allowDomains,
      disallowDomains,
      searchParameters: searchParameters || "remove",
      rejectRegex,
      includeRegex,
    });
  });

  eventEmitter.on("newProcessing", async () => {
    processFile({
      typesToDownload,
      appendToLog,
      processProgress,
      processQueue,
      downloadQueue,
      downloadProgress,
      processedUrls,
      allowDomains,
      disallowDomains,
      rejectRegex,
      includeRegex,
      process,
    });
  });

  let downloadQueue = toDownload || [];
  let processQueue = [];
  let processedUrls = {};
  let downloadedUrls = {};
  if (fs.existsSync(downloadedFile)) {
    const lastDownloadedUrls = JSON.parse(
      await readFile(downloadedFile, "utf-8")
    );

    for (const [key, value] of Object.entries(lastDownloadedUrls)) {
      if (value.status !== "error") {
        downloadedUrls[key] = value;
      }

      if (
        value.path &&
        value.status !== "error" &&
        value.mimeType === "text/html"
      ) {
        processQueue.push({
          url: value.url,
          path: value.path,
        });
      }
    }
  }

  const appendToLog = (line) => {
    try {
      const timestamp = new Date().toISOString(); // Get the current timestamp in ISO format
      const lineWithTimestamp = `${timestamp} ${line}`; // Add the timestamp to the line

      fs.appendFileSync(logFile, lineWithTimestamp + "\n");
    } catch (err) {
      console.error("Failed to write to log file:", err);
    }
  };

  const multi = new cliProgress.MultiBar(
    {
      clearOnComplete: false,
      hideCursor: true,
      format: "  {barName}    {bar}  {percentage}% || {value}/{total} Files",
    },
    cliProgress.Presets.shades_classic
  );

  const downloadProgress = multi.create(downloadQueue.length, 0, {
    barName: "Downloading",
  });
  const processProgress = multi.create(processQueue.length, 0, {
    barName: "Processing ",
  });

  // Keep checking if there's work to do as long as at least one queue is not empty.
  while (downloadQueue.length > 0 || processQueue.length > 0) {
    // Emit events instead of creating tasks
    if (downloadQueue.length > 0) {
      eventEmitter.emit("newDownload");
    }
    if (processQueue.length > 0) {
      eventEmitter.emit("newProcessing");
    }
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Avoid busy waiting
  }

  multi.stop();

  eventEmitter.emit("finish");
}
