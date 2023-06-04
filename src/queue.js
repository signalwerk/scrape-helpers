import fs from "fs";
import path from "path";
import util from "util";
import cliProgress from "cli-progress";
import { processFile } from "./queue/process.js";
import { download } from "./queue/download.js";
import { Semaphore } from "./semaphore.js";

const MAX_CONCURRENT_DOWNLOADS = 50;

const writeFile = util.promisify(fs.writeFile);
const readFile = util.promisify(fs.readFile);

export async function queue({
  toDownload,
  downloadDir,
  statusFile,
  allowDomains,
  downloadedFile,
  logFile,
}) {
  console.log("Starting queue");

  let downloadQueue = toDownload || [];
  let processQueue = [];
  let processedUrls = {};
  let downloadedUrls = {};
  if (fs.existsSync(downloadedFile)) {
    downloadedUrls = JSON.parse(await readFile(downloadedFile, "utf-8"));

    for (const [key, value] of Object.entries(downloadedUrls)) {
      if (value.path && value.status !== "error") {
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

  const downloadSemaphore = new Semaphore(MAX_CONCURRENT_DOWNLOADS);

  // Keep checking if there's work to do as long as at least one queue is not empty.
  while (downloadQueue.length > 0 || processQueue.length > 0) {
    await Promise.all([
      (async () => {
        // Wait for a slot to become available
        await downloadSemaphore.wait();

        // When a slot becomes available, start a download task
        await download({
          appendToLog,
          downloadQueue,
          processedUrls,
          downloadProgress,
          processQueue,
          processProgress,
          downloadDir,
          downloadedFile,
          // Pass the semaphore as a parameter to the download function
          downloadSemaphore,
          downloadedUrls,
          allowDomains,
        });

        // Signal that a slot is now available
        downloadSemaphore.signal();
      })(),

      processFile({
        appendToLog,
        processProgress,
        processQueue,
        downloadQueue,
        downloadProgress,
        processedUrls,
        allowDomains,
      }),
    ]);
  }

  multi.stop();
}
