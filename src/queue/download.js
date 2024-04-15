import axios from "axios";
import fs from "fs";
import path from "path";
import util from "util";
import { getMimeType, getFsPath } from "../getFsPath.js";
import { getNormalizedURL, normalizeURL } from "../normalizeURL.js";
import { ensureDirectoryExistence } from "../ensureDirectoryExistence.js";

const writeFile = util.promisify(fs.writeFile);

export function isDomainAllowed(domain, allowDomains, disallowDomains) {
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

export function isRecected(url, rejectRegex, includeRegex) {
  if (includeRegex) {
    const regex = new RegExp(includeRegex, "g");
    if (regex.test(url)) {
      return false;
    }
  }

  if (rejectRegex) {
    const regex = new RegExp(rejectRegex, "g");
    return regex.test(url);
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
  normalizeOptions,
  rejectRegex,
  includeRegex,
}) {
  while (downloadQueue.length > 0) {
    const url = downloadQueue.shift();

    const normalizedUrl = getNormalizedURL(url, url, {
      ...normalizeOptions,
      removeHash: true,
    });

    const normalizedUrlHref = normalizedUrl.href;

    const isUrlAllowed = !isRecected(
      normalizedUrlHref,
      rejectRegex,
      includeRegex,
    );
    const domainIsAllowed = isDomainAllowed(
      normalizedUrl.hostname,
      allowDomains,
      disallowDomains,
    );

    if (domainIsAllowed && isUrlAllowed) {
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
              ...normalizeOptions,
              removeHash: true,
            },
          );

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
              processQueue.push({
                url: normalizedUrlHref,
                path: filePath,
                mimeType,
                redirect: {
                  url: responseUrl,
                  normalized: normalizedResponseUrl,
                },
              });
              processProgress.setTotal(processProgress.total + 1);
            }
            if (mimeType === "text/css") {
              processQueue.push({
                url: normalizedUrlHref,
                path: filePath,
                mimeType,
                redirect: {
                  url: responseUrl,
                  normalized: normalizedResponseUrl,
                },
              });
              processProgress.setTotal(processProgress.total + 1);
            }

            downloadedUrls[normalizedResponseUrl] = fileStatus;
          }
        } catch (error) {
          appendToLog(`                   ERROR ${normalizedUrlHref}`);
          appendToLog(
            `Failed to download ${normalizedUrlHref}: ${error.message}`,
          );

          fileStatus.status = "error";
          fileStatus.error = error.message;
          downloadedUrls[normalizedUrlHref] = fileStatus;
        }

        await writeFile(
          downloadedFile,
          JSON.stringify(downloadedUrls, null, 2),
        );
      }
    } else {
      appendToLog(
        `REJECT Downloading: ${normalizedUrlHref} (${
          isUrlAllowed ? "url allowed" : "url not allowed"
        }, ${domainIsAllowed ? "domain allowed" : "domain not allowed"})`,
      );
    }

    downloadProgress.increment();
  }
}
