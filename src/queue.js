import axios from "axios";
import fs from "fs";
import path from "path";
import util from "util";
import cliProgress from "cli-progress";
import { processFile } from "./queue/process.js";
import { Semaphore } from "./semaphore.js";

const writeFile = util.promisify(fs.writeFile);
const readFile = util.promisify(fs.readFile);

export async function queue({ toDownload, downloadDir, statusFile }) {
  console.log("Starting queue");

  let downloadQueue = toDownload || [];
  let processQueue = [];
  let processedUrls = {};
  if (fs.existsSync(statusFile)) {
    processedUrls = JSON.parse(await readFile(statusFile, "utf-8"));
  }

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

  const downloadSemaphore = new Semaphore(20); // max 20 downloads at a time

  // Keep checking if there's work to do as long as at least one queue is not empty.
  while (downloadQueue.length > 0 || processQueue.length > 0) {
    await Promise.all([
      downloadSemaphore.wait().then(download),
      processFile({
        processProgress,
        processQueue,
        downloadQueue,
        downloadProgress,
      }),
    ]);
  }

  multi.stop();

  async function download() {
    while (downloadQueue.length > 0) {
      const url = downloadQueue.shift();

      if (!processedUrls[url]) {
        const response = await axios.get(url, { responseType: "arraybuffer" });
        const fileName = url.replace(/[^a-z0-9]/gi, "_").toLowerCase();
        const filePath = path.join(downloadDir, fileName);
        await writeFile(filePath, response.data);

        const fileStatus = { url, status: response.status, path: filePath };
        processQueue.push(fileStatus.path);
        processProgress.setTotal(processQueue.length);

        processedUrls[url] = fileStatus;
        await writeFile(statusFile, JSON.stringify(processedUrls));
      }

      downloadProgress.increment();

      // signal the semaphore when a download has finished
      downloadSemaphore.signal();
    }
  }
}
