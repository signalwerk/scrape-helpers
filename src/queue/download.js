import axios from "axios";
import fs from "fs";
import path from "path";
import util from "util";
import { getMimeType, getFsPath } from "../getFsPath.js";
import { normalizeURL } from "../normalizeURL.js";

const writeFile = util.promisify(fs.writeFile);

function ensureDirectoryExistence(filePath) {
  var dirname = path.dirname(filePath);
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
  }
  return true;
}

export async function download({
  appendToLog,
  downloadQueue,
  downloadedUrls,
  downloadProgress,
  processQueue,
  processProgress,
  downloadDir,
  downloadedFile,
  allowDomains,

}) {
  while (downloadQueue.length > 0) {
    const url = downloadQueue.shift();

    if (!downloadedUrls[url]) {
      const fileStatus = { url, status: null, path: null, error: null };

      try {
        const options = {
          timeout: 5000, // Set a timeout of 5 seconds
          url,
        };

        appendToLog(`START Downloading: ${url}`);
        const response = await axios({ ...options, method: "get" });
        appendToLog(`                   END ${url}`);

        const responseUrl = response.request.res.responseUrl;

        const normalizedResponseUrl = normalizeURL(responseUrl, url, {
          enforceHttps: true,
          removeTrailingSlash: true,
          removeHash: true,
          searchParameters: "remove",
        });

        // const stdResponseUrl = standardizeURL(responseUrl);

        const contentType = response.headers["content-type"];
        const mimeType = getMimeType(contentType);

        if (url !== normalizedResponseUrl) {
          downloadedUrls[url] = {
            ...fileStatus,
            redirect: { url: responseUrl, normalized: normalizedResponseUrl },
          };
          fileStatus.url = normalizedResponseUrl;
        }

        if (!downloadedUrls[normalizedResponseUrl]) {
          let filePath = null;
          if (mimeType === "text/html") {
            const fsPath = getFsPath(normalizedResponseUrl, mimeType);
            filePath = path.join(downloadDir, fsPath);
            ensureDirectoryExistence(filePath);

            await writeFile(filePath, response.data);
          }

          fileStatus.status = response.status;
          fileStatus.path = filePath;

          processQueue.push({ url, path: filePath });
          processProgress.setTotal(processProgress.total + 1);

          downloadedUrls[normalizedResponseUrl] = fileStatus;
        }
      } catch (error) {
        appendToLog(`                   ERROR ${url}`);
        appendToLog(`Failed to download ${url}: ${error.message}`);

        fileStatus.status = "error";
        fileStatus.error = error.message;
        downloadedUrls[url] = fileStatus;
      }

      await writeFile(downloadedFile, JSON.stringify(downloadedUrls, null, 2));
    }

    downloadProgress.increment();
  }
}
