import axios from "axios";
import fs from "fs";
import path from "path";
import util from "util";
import { getMimeType, getFsPath } from "../getFsPath.js";
import { getNormalizedURL, normalizeURL } from "../normalizeURL.js";

const writeFile = util.promisify(fs.writeFile);

function ensureDirectoryExistence(filePath) {
  var dirname = path.dirname(filePath);
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
  }
  return true;
}

function isSubdomain(subdomain, domains) {
  for (let i = 0; i < domains.length; i++) {
    const domain = domains[i];
    if (subdomain.endsWith(`.${domain}`) || subdomain === domain) {
      return true;
    }
  }
  return false;
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

    const normalizedUrl = getNormalizedURL(url, url, {
      enforceHttps: true,
      removeTrailingSlash: true,
      removeHash: true,
      searchParameters: "remove",
    });

    const normalizedUrlHref = normalizedUrl.href;

    if (
      allowDomains.includes(normalizedUrl.hostname) ||
      isSubdomain(normalizedUrl.hostname, allowDomains)
    ) {
      if (!downloadedUrls[normalizedUrlHref]) {
        const fileStatus = {
          url: normalizedUrlHref,
          status: null,
          path: null,
          error: null,
        };

        try {
          const options = {
            timeout: 5000, // Set a timeout of 5 seconds
            url: normalizedUrlHref,
          };

          appendToLog(`START Downloading: ${normalizedUrlHref}`);
          const response = await axios({ ...options, method: "get" });
          appendToLog(`                   END ${normalizedUrlHref}`);

          const responseUrl = response.request.res.responseUrl;

          const normalizedResponseUrl = normalizeURL(
            responseUrl,
            normalizedUrlHref,
            {
              enforceHttps: true,
              removeTrailingSlash: true,
              removeHash: true,
              searchParameters: "remove",
            }
          );

          // const stdResponseUrl = standardizeURL(responseUrl);

          const contentType = response.headers["content-type"];
          const mimeType = getMimeType(contentType);

          if (normalizedUrlHref !== normalizedResponseUrl) {
            downloadedUrls[normalizedUrlHref] = {
              ...fileStatus,
              original: { url, normalized: normalizedUrlHref },
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

            processQueue.push({ url: normalizedUrlHref, path: filePath });
            processProgress.setTotal(processProgress.total + 1);

            downloadedUrls[normalizedResponseUrl] = fileStatus;
          }
        } catch (error) {
          appendToLog(`                   ERROR ${normalizedUrlHref}`);
          appendToLog(
            `Failed to download ${normalizedUrlHref}: ${error.message}`
          );

          fileStatus.status = "error";
          fileStatus.error = error.message;
          downloadedUrls[normalizedUrlHref] = fileStatus;
        }

        await writeFile(
          downloadedFile,
          JSON.stringify(downloadedUrls, null, 2)
        );
      }
    }

    downloadProgress.increment();
  }
}
