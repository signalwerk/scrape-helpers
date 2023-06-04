import cheerio from "cheerio";
import fs from "fs";
import util from "util";
import { getNormalizedURL } from "../normalizeURL.js";

const readFile = util.promisify(fs.readFile);

export async function processFile({
  processProgress,
  processQueue,
  downloadQueue,
  downloadProgress,
  processedUrls,
  allowDomains,
}) {
  while (processQueue.length > 0) {
    const { url, path } = processQueue.shift();

    const content = await readFile(path, "utf-8");
    const $ = cheerio.load(content);
    $("a").each((index, element) => {
      let originalUrl = $(element).attr("href");
      if (originalUrl) {
        const normalizedUrl = getNormalizedURL(originalUrl, url, {
          enforceHttps: true,
          removeTrailingSlash: true,
          removeHash: true,
          searchParameters: "remove",
        });
        const normalizedHref = normalizedUrl.href;

        if (
          allowDomains.includes(normalizedUrl.hostname) ||
          isSubdomain(normalizedUrl.hostname, allowDomains)
        ) {
          if (
            !downloadQueue.includes(normalizedHref) &&
            !processedUrls[normalizedHref]
          ) {
            downloadQueue.push(normalizedHref);
            downloadProgress.setTotal(downloadQueue.length);
          }
        }
      }
    });
    processProgress.increment();
  }
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
