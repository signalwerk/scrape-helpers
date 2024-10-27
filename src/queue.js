import fs from "fs";
import { ensureDirectoryExistence } from "./ensureDirectoryExistence.js";
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
  normalizeOptions,
  rejectRegex,
  includeRegex,
  postProcess,
  process,
}) {
  ensureDirectoryExistence(logFile);

  eventEmitter.on("finish", async () => {
    const bar1 = new cliProgress.SingleBar(
      {
        clearOnComplete: false,
        hideCursor: true,
        format:
          "  post process    {bar}  {percentage}% || {value}/{total} Files",
      },
      cliProgress.Presets.shades_classic,
    );

    bar1.start(Object.keys(downloadedUrls).length, 0);

    for (const [key, value] of Object.entries(downloadedUrls)) {
      bar1.increment();

      const item = downloadedUrls[key];

      appendToLog(`START postprocess: ${key}`);

      if (
        postProcess["text/html"] &&
        item.status !== "error" &&
        item.mimeType === "text/html"
      ) {
        if (!fs.existsSync(`${item.path}.orig`)) {
          fs.copyFileSync(item.path, `${item.path}.orig`);
        }

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
        if (!fs.existsSync(`${item.path}.orig`)) {
          fs.copyFileSync(item.path, `${item.path}.orig`);
        }

        appendToLog(`START postprocess text/css`);

        await postProcess["text/css"]({
          appendToLog,
          downloadedFile: item,
          downloadedFiles: downloadedUrls,
        });
      }
      if (
        postProcess["application/javascript"] &&
        item.status !== "error" &&
        item.mimeType === "application/javascript"
      ) {
        if (!fs.existsSync(`${item.path}.orig`)) {
          fs.copyFileSync(item.path, `${item.path}.orig`);
        }

        appendToLog(`START postprocess application/javascript`);

        await postProcess["application/javascript"]({
          appendToLog,
          downloadedFile: item,
          downloadedFiles: downloadedUrls,
        });
      }
    }

    bar1.stop();
  });

  eventEmitter.on("newDownload", async () => {
    appendToLog(`ON newDownload`);
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
      normalizeOptions,
      rejectRegex,
      includeRegex,
    });
  });

  eventEmitter.on("newProcessing", async () => {
    appendToLog(`ON newProcessing`);
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
      await readFile(downloadedFile, "utf-8"),
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
          mimeType: value.mimeType,
          redirect: value.redirect,
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
    cliProgress.Presets.shades_classic,
  );

  const downloadProgress = multi.create(downloadQueue.length, 0, {
    barName: "Downloading",
  });

  const processProgress = multi.create(processQueue.length, 0, {
    barName: "Processing ",
  });

  // Keep checking if there's work to do as long as at least one queue is not empty.
  while (
    downloadQueue.length > 0 ||
    processQueue.length > 0 ||
    !(downloadProgress.value > 1) // Check if download started
  ) {
    // Emit events instead of creating tasks
    if (downloadQueue.length > 0) {
      appendToLog(`EMIT newDownload`);
      eventEmitter.emit("newDownload");
    }
    if (processQueue.length > 0) {
      appendToLog(`EMIT newProcessing`);
      eventEmitter.emit("newProcessing");
    }

    await new Promise((resolve) => setTimeout(resolve, 1000)); // Avoid busy waiting
  }

  multi.stop();

  // Wait for all downloads to finish
  let maxWait = 20;
  while (downloadProgress.value < downloadProgress.total && maxWait-- > 0) {
    console.log(
      `Finishing downloads: ${downloadProgress.value}/${downloadProgress.total}`,
    );
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Avoid busy waiting
  }
  console.log(
    `Finishing downloads: ${downloadProgress.value}/${downloadProgress.total}`,
  );

  eventEmitter.emit("finish");
}
