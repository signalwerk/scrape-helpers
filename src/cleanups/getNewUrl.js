import { getNormalizedURL } from "../normalizeURL.js";
import { getFsPath } from "../getFsPath.js";

// A function to replace the old URL with a new one. Implement your own logic here.

export function getNewUrl(
  oldUrl,
  currentUrl,
  downloadedFiles,
  normalizeOptions
) {
  const fullUrl = getNormalizedURL(oldUrl, currentUrl, normalizeOptions);

  const destinationItem = downloadedFiles[fullUrl.href];

  if (destinationItem) {
    const newUrl = getFsPath(destinationItem.url, destinationItem.mimeType);
    const finalUrl = `${fullUrl.protocol}/${newUrl}`; // should be destinationItem's protocol

    const path = new URL(finalUrl);
    const newPath = path
      .getRelativeURL(currentUrl, false, false)
      .replace("?", "%3F")
      .replace(":", "%3A");

    return newPath;
  }

  return oldUrl;
}
