import axios from "axios";
import fs from "fs";
import path from "path";
import util from "util";

const writeFile = util.promisify(fs.writeFile);

export async function download({
  appendToLog,
  downloadQueue,
  processedUrls,
  downloadProgress,
  processQueue,
  processProgress,
  downloadDir,
  statusFile,
}) {
  while (downloadQueue.length > 0) {
    const url = downloadQueue.shift();

    if (!processedUrls[url]) {
      try {
        appendToLog(`START Downloading: ${url}`);
        const response = await axios.get(url, { responseType: "arraybuffer" });
        appendToLog(`END Downloading`);

        const contentType = response.headers["content-type"];
        const isHTML = contentType && contentType.includes("text/html");

        let filePath = null;
        if (isHTML) {
          const fileName = url.replace(/[^a-z0-9_\-]/gi, "_").toLowerCase();
          filePath = path.join(downloadDir, fileName);
          await writeFile(filePath, response.data);
        }

        const fileStatus = { url, status: response.status, path: filePath };
        processQueue.push({ url, path: filePath });
        processProgress.setTotal(processQueue.length);
        processedUrls[url] = fileStatus;
      } catch (error) {
        // console.error(`Failed to download ${url}: ${error.message}`);
        processedUrls[url] = { url, status: "error", error: error.message };
        processQueue.push({ url, path: null });
        processProgress.setTotal(processQueue.length);
      }

      await writeFile(statusFile, JSON.stringify(processedUrls, null, 2));
    }

    downloadProgress.increment();
  }
}
