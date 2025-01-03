import fs from "fs";
import path from "path";
import { getExtensionOfMime } from "../utils/mime.js";
import { UrlPatcher } from "../utils/UrlPatcher.js";
import { getExtension, sameExtension, fixFilename } from "../utils/fsUtils.js";

export async function writeData({ job, data, metadata }, next) {
  const baseDir = "./DATA/OUT";

  const fsNameOfUri = urlToPath(job.data.uri, metadata.headers["content-type"]);
  const filePath = path.resolve(baseDir, fsNameOfUri);

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
    throw new Error(`File not in cache`);
  }
  return next();
}

const patcher = new UrlPatcher();
patcher
  .addRule({
    // adjust http to https
    transform: (url) => {
      url.protocol = "https";
      return url;
    },
    includes: [/^http:\/\//],
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
            // pathnameWithoutFsExt: url.pathname.slice(0, -fsExt.length - 1),
          },
        ];
      }

      return [url, { ...data, fsExt }];
    },
    excludes: [/\/$/],
  });

export function urlToPath(uri, mime) {
  let [url, data] = patcher.transform(decodeURIComponent(uri));
  const mimeExt = getExtensionOfMime(mime);

  let result = [
    url.protocol.replace(":", ""),
    "/",
    decodeURIComponent(url.hostname),
  ];

  const filename = [decodeURIComponent(url.pathname)];

  // handle the search params
  if (url.search) {
    filename.push(url.search);

    // If there is a search, we need to add the extension
    if (mimeExt) {
      filename.push(`.${mimeExt}`);
    } else if (data.fsExt) {
      filename.push(`.${data.fsExt}`);
    }
  }

  // if there is no search params let's check if we need to add the extension
  if (!url.search) {
    if (!sameExtension(data.fsExt, mimeExt)) {
      if (mimeExt) {
        filename.push(`.${mimeExt}`);
      }
    }
  }

  result.push(fixFilename(filename.join("")));

  return result.join("");
}

export function urlToPathOLD(uri, mime) {
  const mimeExt = getExtensionOfMime(mime);

  const parsedUrl = new URL(uri);
  let queryParams = new URLSearchParams(parsedUrl.search);
  // Convert to array, sort, and reconstruct
  let sortedQuery = new URLSearchParams(
    [...queryParams.entries()].sort((a, b) => a[0].localeCompare(b[0])),
  ).toString();

  const pathname = parsedUrl.pathname;

  const dirname = path.dirname(pathname);
  const basename = path.basename(pathname);

  const fsExt = getExtension(pathname);
  const ext = mimeExt || fsExt;
  const hasExt = basename.endsWith(`.${fsExt}`);

  let result = `${parsedUrl.protocol.replace(":", "")}/${parsedUrl.hostname}`;

  if (pathname.endsWith("/") && mimeExt === "html") {
    return `${result}${pathname}index.html`;
  }

  let filename = null;

  if (hasExt || sortedQuery) {
    filename = basename;
  } else {
    filename = `${basename}.${ext}`;
  }

  if (sortedQuery) {
    filename += `?${decodeURIComponent(sortedQuery)}.${ext}`;
  }

  if (dirname && dirname !== "/") {
    result += `${dirname}`;
  }

  result += `/${fixFilename(filename)}`;

  return result;
}
