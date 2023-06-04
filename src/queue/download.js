import axios from "axios";
import fs from "fs";
import path from "path";
import util from "util";

const writeFile = util.promisify(fs.writeFile);

export async function download(
  downloadQueue,
  processedUrls,
  downloadProgress,
  processQueue,
  processProgress,
  downloadDir,
  statusFile
) {
  while (downloadQueue.length > 0) {
    const url = downloadQueue.shift();

    if (!processedUrls[url]) {
      const response = await axios.get(url, { responseType: "arraybuffer" });

      const contentType = response.headers["content-type"];
      const isHTML = contentType && contentType.includes("text/html");

      if (isHTML) {
        const fileName = url.replace(/[^a-z0-9_\-]/gi, "_").toLowerCase();
        const filePath = path.join(downloadDir, fileName);
        await writeFile(filePath, response.data);

        const fileStatus = { url, status: response.status, path: filePath };
        processQueue.push({ url, path: filePath });
        processProgress.setTotal(processQueue.length);

        processedUrls[url] = fileStatus;
      } else {
        const fileStatus = { url, status: response.status, path: null };
        processedUrls[url] = fileStatus;
      }

      await writeFile(statusFile, JSON.stringify(processedUrls, null, 2));
    }

    downloadProgress.increment();
  }
}
