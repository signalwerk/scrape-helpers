import cheerio from "cheerio";
import fs from "fs";
import util from "util";
import url from "url";
import { normalizeURL, absoluteUrl } from "../normalizeURL.js";

const readFile = util.promisify(fs.readFile);

export async function processFile({
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
    $("a").each((index, element) => {
      let originalUrl = $(element).attr("href");
      if (originalUrl) {
        // const absoluteUrl = new url.URL(originalUrl, url).href;
        // const absoluteUrl = normalizeURL(originalUrl, url);
        const fullUrl = absoluteUrl(originalUrl, url);

        if (
          !downloadQueue.includes(fullUrl) &&
          !processedUrls[fullUrl]
        ) {
          appendToLog(`Append Downloading: ${fullUrl} (from ${url})`);
          downloadQueue.push(fullUrl);
          downloadProgress.setTotal(downloadProgress.total + 1);
        }
      }
    });
    processProgress.increment();
  }
}
