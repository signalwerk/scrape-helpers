import axios from "axios";
import fs from "fs";
import path from "path";
import util from "util";
import { getMimeType, getFsPath } from "../getFsPath.js";
import { getNormalizedURL, normalizeURL } from "../normalizeURL.js";
import { ensureDirectoryExistence } from "../ensureDirectoryExistence.js";

const writeFile = util.promisify(fs.writeFile);

function isDomainAllowed(domain, allowDomains, disallowDomains) {
  if (disallowDomains.includes(domain)) {
    return false;
  }

  if (
    allowDomains.length === 0 ||
    allowDomains.includes(domain) ||
    isSubdomain(domain, allowDomains)
  ) {
    return true;
  }

  return false;
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
function isMediaURL(url) {
  // Specify the media-type endings
  const mediaTypes = [".pdf", ".jpg", ".jpeg", ".png", ".gif", ".docx", ".doc"];

  // Check if the getNormalizedURL ends with any media-type ending
  for (const mediaType of mediaTypes) {
    if (url.toLowerCase().endsWith(mediaType)) {
      return true;
    }
  }

  return false;
}

export async function download({
  typesToDownload,
  appendToLog,
  downloadQueue,
  downloadedUrls,
  downloadProgress,
  processQueue,
  processProgress,
  downloadDir,
  downloadedFile,
  allowDomains,
  disallowDomains,
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
      isDomainAllowed(normalizedUrl.hostname, allowDomains, disallowDomains) //&&
      //   !isMediaURL(normalizedUrlHref)
    ) {
      if (!downloadedUrls[normalizedUrlHref]) {
        const fileStatus = {
          url: normalizedUrlHref,
          status: null,
          mimeType: null,
          path: null,
          error: null,
        };

        try {
          const options = {
            timeout: 15000, // Set a timeout
            url: normalizedUrlHref,
            responseType: "stream",
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
            const fsPath = getFsPath(normalizedResponseUrl, mimeType);
            filePath = path.join(downloadDir, fsPath);
            ensureDirectoryExistence(filePath);

            //   await writeFile(filePath, response.data);
            const writeStream = fs.createWriteStream(filePath);
            response.data.pipe(writeStream);
            await new Promise((resolve, reject) => {
              writeStream.on("finish", resolve);
              writeStream.on("error", reject);
            });

            fileStatus.status = response.status;
            fileStatus.path = filePath;
            fileStatus.mimeType = mimeType;

            if (mimeType === "text/html") {
              processQueue.push({ url: normalizedUrlHref, path: filePath });
              processProgress.setTotal(processProgress.total + 1);
            }

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
