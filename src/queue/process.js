import cheerio from "cheerio";
import fs from "fs";
import util from "util";
import { absoluteUrl } from "../normalizeURL.js";
import "../cleanups/getRelativeURL.js";

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

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

    let hasEdits = false;
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

    function createRelative(selector, attribute) {
      const links = $(selector);
      links.each((i, el) => {
        const href = $(el).attr(attribute);

        if (href && (href.startsWith("/") || href.startsWith("."))) {
          const destination = absoluteUrl(href, url);

          const path = new URL(destination);
          const newPath = path.getRelativeURL(url, false, false);

          if (href !== newPath) {
            hasEdits = true;
            $(el).attr(attribute, newPath);
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

    createRelative("a", "href");
    createRelative("img", "src");
    createRelative("script", "src");
    createRelative("link[rel=stylesheet]", "href");

    if (hasEdits) {
      writeFile(path, $.html());
      writeFile(`${path}.orig`, content);
    }

    processProgress.increment();
  }
}
