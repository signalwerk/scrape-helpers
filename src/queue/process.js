import cheerio from "cheerio";
import fs from "fs";
import util from "util";
import { absoluteUrl } from "../normalizeURL.js";

const readFile = util.promisify(fs.readFile);

export async function processFile({
  typesToDownload,
  appendToLog,
  processProgress,
  processQueue,
  downloadQueue,
  downloadProgress,
  processedUrls,
}) {
  while (processQueue.length > 0) {
    appendToLog(`START processFile:`);
    const { url, path } = processQueue.shift();

    appendToLog(`START processFile: ${url}`);
    appendToLog(`                   ${path}`);

    const content = await readFile(path, "utf-8");
    const $ = cheerio.load(content);

    function processElements(selector, attribute) {
      $(selector).each((index, element) => {
        let originalUrl = $(element).attr(attribute);
        if (originalUrl) {
          const fullUrl = absoluteUrl(originalUrl, url);

          if (!downloadQueue.includes(fullUrl) && !processedUrls[fullUrl]) {
            appendToLog(`Append Downloading: ${fullUrl} (from ${url})`);
            downloadQueue.push(fullUrl);
            downloadProgress.setTotal(downloadProgress.total + 1);
          }
        }
      });
    }

    // Process anchor links
    processElements("a", "href");

    // Process images if needed
    if (typesToDownload.includes("image")) {
      processElements("img", "src");
    }

    // Process scripts if needed
    if (typesToDownload.includes("script")) {
      processElements("script", "src");
    }

    if (typesToDownload.includes("stylesheet")) {
      processElements("link[rel=stylesheet]", "href");
    }

    processProgress.increment();
  }
}
