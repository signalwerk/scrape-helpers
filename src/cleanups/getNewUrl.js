import { getNormalizedURL } from "../normalizeURL.js";
import { getFsPath } from "../getFsPath.js";
import "./getRelativeURL.js";

// A function to replace the old URL with a new one. Implement your own logic here.

export function getNewUrl({
  url,
  refferer,
  downloadedFiles,
  normalizeOptions,
  appendToLog,
}) {
  let fullUrl = null;
  try {
    fullUrl = getNormalizedURL(url, refferer, normalizeOptions);
  } catch (error) {
    appendToLog(
      `ERROR getNewUrl:
                                  url ${url}
                                  refferer ${refferer}
                                  options ${JSON.stringify(normalizeOptions)}`,
    );

    return url;
  }

  const destinationItem = downloadedFiles[fullUrl.href];

  if (destinationItem) {
    const endItem = destinationItem.redirect
      ? downloadedFiles[destinationItem.redirect.url]
      : destinationItem;

    const newUrl = getFsPath(endItem.url, endItem.mimeType);
    const finalUrl = `${fullUrl.protocol}/${newUrl}`; // should be destinationItem's protocol

    const path = new URL(finalUrl.replace("?", "%3F"));
    const newPath = path
      .getRelativeURL(refferer, false, false)
      .replace(":", "%3A");

    appendToLog(
      `START getNewUrl:
                                  url ${url}
                                  refferer ${refferer}
                                  newUrl ${newUrl}
                                  newPath ${newPath}`,
      // options ${JSON.stringify(normalizeOptions)}
    );

    return newPath;
  }

  appendToLog(
    `START getNewUrl missing:
                                url ${url}
                                refferer ${refferer}
                                fullUrl ${fullUrl.href}
                                destinationItem ${
                                  destinationItem
                                    ? destinationItem.url
                                    : "undefined"
                                }
                                `,
  );

  return url;
}
