import cheerio from "cheerio";
import fs from "fs";
import url from "url";
import util from "util";

const readFile = util.promisify(fs.readFile);

function normalizeURL(originalUrl, pageUrl) {
  let normalizedUrl = originalUrl.replace("//", "/");
  let parsedUrl = new url.URL(normalizedUrl, pageUrl);

  // sort GET parameters to avoid duplicate downloads
  let searchParams = new URLSearchParams(parsedUrl.search);
  searchParams.sort();
  parsedUrl.search = searchParams.toString();

  return parsedUrl.href;
}

export async function processFile({
  processProgress,
  processQueue,
  downloadQueue,
  downloadProgress,
}) {
  while (processQueue.length > 0) {
    const filePath = processQueue.shift();

    const content = await readFile(filePath, "utf-8");
    const $ = cheerio.load(content);
    $("a").each((index, element) => {
      // let originalUrl = $(element).attr("href");
      // if (originalUrl) {
      //   const normalizedUrl = normalizeURL(originalUrl, filePath);
      //   if (
      //     !downloadQueue.includes(normalizedUrl) &&
      //     !processedUrls[normalizedUrl]
      //   ) {
      //     downloadQueue.push(normalizedUrl);
      //     downloadProgress.setTotal(downloadQueue.length);
      //   }
      // }
    });
    processProgress.increment();
  }
}
