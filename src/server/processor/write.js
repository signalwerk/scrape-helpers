import fs from "fs";
import path from "path";
import { writeFile } from "../utils/writeFile.js";
import { getExtensionOfMime } from "../utils/mime.js";
import { UrlPatcher } from "../utils/UrlPatcher.js";

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

export async function writeData({ job, data, metadata }, next) {
  const baseDir = "./DATA/OUT";

  const fsNameOfUri = urlToPath(job.data.uri, metadata.headers["content-type"]);
  const filePath = path.resolve(baseDir, fsNameOfUri);

  await writeFile(filePath, data);
  job.log(`Wrote data to ${filePath}`);
  next();
}

function getExtension(filename) {
  var ext = path.extname(filename || "").split(".");
  return ext[ext.length - 1];
}

// Utility function to normalize extension based on the configuration
function normalizeExtension(extension) {
  if (!extension) {
    return extension;
  }

  // Convert to lowercase first
  const lowerCaseExt = extension.toLowerCase();

  // Check if this extension has an equivalent
  for (const pair of equivalentExtensions) {
    if (pair.includes(lowerCaseExt)) {
      return pair[0]; // Always return the first item as the 'normalized' version
    }
  }

  return lowerCaseExt; // If no equivalent found, return as is
}

function sameExtension(fsExt, mimeExt) {
  // Normalize extensions
  const normalizedFsExt = normalizeExtension(fsExt);
  const normalizedMimeExt = normalizeExtension(mimeExt);

  return normalizedFsExt === normalizedMimeExt;
}

// Configuration for equivalent extensions
const equivalentExtensions = [
  ["jpg", "jpeg"],
  ["htm", "html"],

  // Add more equivalent pairs here
  // ["ext1", "ext2"],
];

function fixFilename(name) {
  const filename = name; // .replaceAll("%7C", "|");
  const ext = path.extname(filename);
  const basename = decodeURI(path.basename(filename, ext));

  const result = `${basename.slice(0, 240 - ext.length)}${ext}`;

  return result;
}

export function urlToPath(uri, mime) {
  const mimeExt = getExtensionOfMime(mime);

  const patcher = new UrlPatcher();
  patcher
    .addRule({
      transform: (url) => {
        url.pathname += "index.html";
        return url;
      },
      includes: [/\/$/],
    })
    .addRule({
      transform: (url) => {
        // Sort query params
        url.search = new URLSearchParams(
          [...new URLSearchParams(url.search).entries()].sort((a, b) =>
            a[0].localeCompare(b[0]),
          ),
        ).toString();
        return url;
      },
    });

  const patchURI = patcher.patch(uri, mime);


  const parsedUrl = new URL(patchURI);
  // Convert to array, sort, and reconstruct
  let sortedQuery = parsedUrl.search;

  const pathname = parsedUrl.pathname;

  const dirname = path.dirname(pathname);
  const basename = path.basename(pathname);

  const fsExt = getExtension(pathname);
  const ext = mimeExt || fsExt;
  const hasExt = basename.endsWith(`.${fsExt}`);

  let result = `${parsedUrl.protocol.replace(":", "")}/${parsedUrl.hostname}`;

  let filename = null;

  if (hasExt || sortedQuery) {
    filename = basename;
  } else {
    filename = `${basename}.${ext}`;
  }

  if (sortedQuery) {
    filename += `${decodeURIComponent(sortedQuery)}.${ext}`;
  }

  if (dirname && dirname !== "/") {
    result += `${dirname}`;
  }

  result += `/${fixFilename(filename)}`;

  return result;
}
