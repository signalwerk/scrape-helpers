import axios from "axios";
import https from "https";
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

export function isRejected(url, rejectRegex, includeRegex) {
  // If includeRegex is provided and does NOT match, return true (rejected)
  if (includeRegex) {
    const includeRegexObj = new RegExp(includeRegex, "g");
    if (!includeRegexObj.test(url)) {
      return true;
    }
  }

  // If rejectRegex is provided and matches, return true (rejected)
  if (rejectRegex) {
    const rejectRegexObj = new RegExp(rejectRegex, "g");
    return rejectRegexObj.test(url);
  }

  // If neither condition is met, return false (not rejected)
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
    let normalizedUrl;
    let normalizedUrlHref;
    let isUrlAllowed;
    let domainIsAllowed;

    if (!url) {
      downloadProgress.increment();
      continue;
    }

    try {
      normalizedUrl = getNormalizedURL(url, url, {
        ...normalizeOptions,
        removeHash: true,
      });
      normalizedUrlHref = normalizedUrl.href;

      isUrlAllowed = !isRejected(normalizedUrlHref, rejectRegex, includeRegex);
      domainIsAllowed = isDomainAllowed(
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
              headers: {
                // we are chrome right?
                "User-Agent":
                  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
              },
              httpsAgent: new https.Agent({
                rejectUnauthorized: false,
              }),
            };

            appendToLog(`START Downloading: ${normalizedUrlHref}`);
            const response = await axios({ ...options, method: "get" });
            appendToLog(`                   END ${normalizedUrlHref}`);

            const responseUrl = response.request.res.responseUrl;

            let normalizedResponseUrl;
            try {
              normalizedResponseUrl = normalizeURL(
                responseUrl,
                normalizedUrlHref,
                {
                  ...normalizeOptions,
                  removeHash: true,
                },
              );
            } catch (error) {
              appendToLog(
                `ERROR Normalizing Response URL: ${responseUrl} - ${error.message}`,
              );
              downloadProgress.increment();
              continue;
            }

            const contentType = response.headers["content-type"];
            const mimeType = getMimeType(contentType);

            if (normalizedUrlHref !== normalizedResponseUrl) {
              downloadedUrls[normalizedUrlHref] = {
                ...fileStatus,
                original: { url, normalized: normalizedUrlHref },
                redirect: {
                  url: responseUrl,
                  normalized: normalizedResponseUrl,
                },
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

              if (mimeType === "text/html" || mimeType === "text/css") {
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

          try {
            await writeFile(
              downloadedFile,
              JSON.stringify(downloadedUrls, null, 2),
            );
          } catch (error) {
            appendToLog(
              `ERROR Writing to file: ${downloadedFile} - ${error.message}`,
            );
          }
        }
      } else {
        appendToLog(
          `REJECT Downloading: ${normalizedUrlHref} (${
            isUrlAllowed ? "url allowed" : "url not allowed"
          }, ${domainIsAllowed ? "domain allowed" : "domain not allowed"})`,
        );
      }
    } catch (error) {
      appendToLog(`ERROR Processing URL: ${url} - ${error.message}`);
    } finally {
      downloadProgress.increment();
    }
  }
}
