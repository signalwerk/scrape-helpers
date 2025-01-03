import fs from "fs";
import path from "path";
import { absoluteUrl } from "../utils/absoluteUrl.js";
import { getRelativeURL } from "../utils/getRelativeURL.js";
import { getExtensionOfMime, getMimeWithoutEncoding } from "../utils/mime.js";
import { UrlPatcher } from "../utils/UrlPatcher.js";
import { writeFile } from "../utils/writeFile.js";
import { getExtension, sameExtension, fixFilename } from "../utils/fsUtils.js";
import { processElements } from "../utils/processElements.js";

export async function writeData({ job, data, metadata }, next) {
  const baseDir = "./DATA/OUT";

  const fsNameOfUri = urlToPath(job.data.uri, metadata.headers["content-type"]);
  const filePath = path.join(baseDir, fsNameOfUri);

  await writeFile(filePath, data);
  job.log(`Wrote data to ${filePath}`);
  next();
}

export function handleRedirected({ job, events, cache, getKey }, next) {
  const key = getKey(job);

  if (cache.has(key)) {
    job.log(`File already in cache`);

    const metadata = cache.getMetadata(key);
    if (metadata.redirected) {
      job.log(`Cache has redirect, follow redirecting`);
      const newUri = metadata.redirected;

      // Create a new job for the redirected URI
      const writeJobData = {
        ...job.data,
        uri: newUri,
        _parent: job.id,
      };
      job.log(`Created write job – Redirected to new URI: ${newUri}`);
      events?.emit("createWriteJob", writeJobData);

      return next(null, true);
    } else if (metadata.error) {
      job.error = metadata.error;
      throw new Error(
        `Job is cached but has error: ${job.error} no need proceed`,
      );
    } else {
      job.data.cache = {
        status: "cached",
        key,
      };
    }
  } else {
    job.data.cache = {
      status: "not-cached",
      key,
    };
    // throw new Error(`File not in cache`);
    job.log(`File not in cache`);
    return next(null, true);
  }
  return next();
}

const patcher = new UrlPatcher();
patcher
  .addRule({
    // adjust http & https to file
    transform: (url) => {
      url.protocol = "file";
      return url;
    },
    includes: [/^http(s)?:\/\//],
  })
  .addRule({
    // Add index.html to the end of the pathname if it ends with a slash
    transform: (url, data) => {
      url.pathname += "index";
      return [url, { ...data, fsExt: "html" }];
    },
    includes: [/\/$/],
  })
  .addRule({
    // Sort query params
    transform: (url) => {
      url.search = new URLSearchParams(
        [...new URLSearchParams(url.search).entries()].sort((a, b) =>
          a[0].localeCompare(b[0]),
        ),
      ).toString();
      return url;
    },
  })
  .addRule({
    // detect the extension from the pathname
    transform: (url, data) => {
      const fsExt = getExtension(url.pathname) || "";

      if (fsExt) {
        return [
          url,
          {
            ...data,
            fsExt,
          },
        ];
      }

      return [url, { ...data, fsExt }];
    },
    excludes: [/\/$/],
  })
  .addRule({
    // add search params to the pathname and fix file extension
    transform: (url, data) => {
      if (url.search) {
        url.pathname += url.search;
        url.search = "";

        // If there is a search, we need to add the extension
        if (data.mimeExt) {
          url.pathname += `.${data.mimeExt}`;
        } else if (data.fsExt) {
          url.pathname += `.${data.fsExt}`;
        }
      } else {
        if (!sameExtension(data.fsExt, data.mimeExt)) {
          if (data.mimeExt) {
            url.pathname += `.${data.mimeExt}`;
          }
        }
      }

      return url;
    },
  })
  .addRule({
    // fix filename length
    transform: (url, data) => {
      url.pathname = fixFilename(url.pathname);
      return url;
    },
  });

export function urlToPath(uri, mime) {
  const mimeExt = getExtensionOfMime(mime);
  let url = patcher.patch(uri, { mimeExt });

  let result = decodeURIComponent(url);

  return result.replace("file://", "/");
}

export async function rewriteHtml(
  { job, mime, cache, getKey, getUrl, events, $ },
  next,
) {
  job.log(`rewriteHtml start`);

  let baseUrl =
    absoluteUrl($("base")?.attr("href") || "", job.data.uri) || job.data.uri;

  const mimeExt = getExtensionOfMime(mime);

  let fileBaseUrl = patcher.patch(baseUrl, { mimeExt });

  processElements({
    $,
    cb: (url) => {
      const fullUrl = absoluteUrl(url, baseUrl);
      if (!fullUrl) return;

      const writeJobData = {
        ...job.data,
        uri: fullUrl,
        _parent: job.id,
      };

      job.log(`Created write job for resource: ${fullUrl}`);
      events?.emit("createWriteJob", writeJobData);

      const key = getKey(fullUrl);
      if (cache.has(key)) {
        // urlToPath(uri, mime)
        const metadata = cache.getMetadata(key);
        const mimeExt = getExtensionOfMime(metadata.headers["content-type"]);

        let fileAbsoluteUrl = patcher.patch(fullUrl, { mimeExt });

        const patchedUrl = getUrl
          ? getUrl({ absoluteUrl: fileAbsoluteUrl, baseUrl: fileBaseUrl })
          : getRelativeURL(fileAbsoluteUrl, fileBaseUrl, false, false);

        job.log(`rewrite ${fullUrl} to ${patchedUrl}`);

        return patchedUrl;
      }
    },
  });

  job.log(`parseHtml done`);
  next();
}
