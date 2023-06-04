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
        const options = {
          timeout: 5000, // Set a timeout of 5 seconds
          url,
        };

        appendToLog(`START Downloading: ${url}`);

        // const response = await axios({ ...options, method: "head" });
        // const response = await axios({
        //     ...options,
        //     method: "get",
        //     responseType: "arraybuffer",
        //   });
        const response = await axios({ ...options, method: "get" });

        appendToLog(`                   END ${url}`);

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
        processProgress.setTotal(processProgress.total + 1);
        processedUrls[url] = fileStatus;
      } catch (error) {
        appendToLog(`                   ERROR ${url}`);
        appendToLog(`Failed to download ${url}: ${error.message}`);
        processedUrls[url] = { url, status: "error", error: error.message };
      }

      await writeFile(statusFile, JSON.stringify(processedUrls, null, 2));
    }

    downloadProgress.increment();
  }
}
