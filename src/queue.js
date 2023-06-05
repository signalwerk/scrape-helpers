import fs from "fs";
import path from "path";
import util from "util";
import cliProgress from "cli-progress";
import { EventEmitter } from "events";
import { processFile } from "./queue/process.js";
import { download } from "./queue/download.js";
import { Semaphore } from "./semaphore.js";

const MAX_CONCURRENT_DOWNLOADS = 1;

const writeFile = util.promisify(fs.writeFile);
const readFile = util.promisify(fs.readFile);

const eventEmitter = new EventEmitter();

export async function queue({
  toDownload,
  downloadDir,
  statusFile,
  allowDomains,
  disallowDomains,

  downloadedFile,
  logFile,
}) {
  console.log("Starting queue");

  eventEmitter.on("newDownload", async () => {
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
      downloadedUrls,
      allowDomains,
      disallowDomains
    });
  });

  eventEmitter.on("newProcessing", async () => {
    processFile({
      appendToLog,
      processProgress,
      processQueue,
      downloadQueue,
      downloadProgress,
      processedUrls,
      allowDomains,
      disallowDomains,


    });
  });

  let downloadQueue = toDownload || [];
  let processQueue = [];
  let processedUrls = {};
  let downloadedUrls = {};
  if (fs.existsSync(downloadedFile)) {
    const lastDownloadedUrls = JSON.parse(await readFile(downloadedFile, "utf-8"));

    for (const [key, value] of Object.entries(lastDownloadedUrls)) {

        if(value.status !== "error"){
        downloadedUrls[key] = value}


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
}
