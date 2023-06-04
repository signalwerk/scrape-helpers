import cheerio from "cheerio";
import fs from "fs";
import url from "url";
import util from "util";

const readFile = util.promisify(fs.readFile);

function normalizeURL(originalUrl, pageUrl) {
  let normalizedUrl = originalUrl.replace("//", "/");
  let parsedUrl = new url.URL(normalizedUrl, pageUrl);

  // Remove anchors from the URL
  parsedUrl.hash = "";

  // Remove the default port for http and https
  if (parsedUrl.protocol === "http:" && parsedUrl.port === "80") {
    parsedUrl.port = "";
  }
  if (parsedUrl.protocol === "https:" && parsedUrl.port === "443") {
    parsedUrl.port = "";
  }


  // remove trailing slash
  if (parsedUrl.pathname.endsWith("/")) {
    parsedUrl.pathname = parsedUrl.pathname.slice(0, -1);
  }

  // remove get parameters
  parsedUrl.search = "";

  // set protocol to https
  parsedUrl.protocol = "https:";

  // Sort GET parameters to avoid duplicate downloads
  // let searchParams = new URLSearchParams(parsedUrl.search);
  // searchParams.sort();
  // parsedUrl.search = searchParams.toString();

  return parsedUrl.href;
}

export async function processFile({
  processProgress,
  processQueue,
  downloadQueue,
  downloadProgress,
  processedUrls,
}) {
  while (processQueue.length > 0) {
    const { url, path } = processQueue.shift();

    const content = await readFile(path, "utf-8");
    const $ = cheerio.load(content);
    $("a").each((index, element) => {
      let originalUrl = $(element).attr("href");
      if (originalUrl) {
        const normalizedUrl = normalizeURL(originalUrl, url);
        if (
          !downloadQueue.includes(normalizedUrl) &&
          !processedUrls[normalizedUrl]
        ) {
          downloadQueue.push(normalizedUrl);
          downloadProgress.setTotal(downloadQueue.length);
        }
      }
    });
    processProgress.increment();
  }
}
