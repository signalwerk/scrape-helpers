import fs from "fs";
import path from "path";
import util from "util";
import cliProgress from "cli-progress";
import { processFile } from "./queue/process.js";
import { download } from "./queue/download.js";
import { Semaphore } from "./semaphore.js";

const MAX_CONCURRENT_DOWNLOADS = 20;

const writeFile = util.promisify(fs.writeFile);
const readFile = util.promisify(fs.readFile);

export async function queue({
  toDownload,
  downloadDir,
  statusFile,
  allowDomains,
  logFile,
}) {
  console.log("Starting queue");

  let downloadQueue = toDownload || [];
  let processQueue = [];
  let processedUrls = {};
  if (fs.existsSync(statusFile)) {
    processedUrls = JSON.parse(await readFile(statusFile, "utf-8"));
  }

  const appendToLog = (line) => {
    fs.appendFile(logFile, line + "\n", (err) => {
      if (err) {
        console.error("Failed to write to log file:", err);
      }
    });
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
      downloadSemaphore
        .wait()
        .then(() =>
          download({
            appendToLog,
            downloadQueue,
            processedUrls,
            downloadProgress,
            processQueue,
            processProgress,
            downloadDir,
            statusFile,
          })
        ),
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
