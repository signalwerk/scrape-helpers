import { URL } from "url";

export function absoluteUrl(url, baseUrl) {
  try {
    let parsedUrl = new URL(url, baseUrl);
    return parsedUrl.href;
  } catch (error) {
    // console.error('Error occurred while parsing the URL:', error);
    return "";
  }
}

export function getNormalizedURL(
  originalUrl,
  pageUrl,
  options = {
    enforceHttps: false,
    removeTrailingSlash: false,
    removeHash: false,
    searchParameters: "keep",
  }
) {
  let parsedUrl = new URL(originalUrl, pageUrl);

  // Remove hash if the option is set to true
  if (options.removeHash) {
    parsedUrl.hash = "";
  }

  // Remove the default port for http and https
  if (parsedUrl.protocol === "http:" && parsedUrl.port === "80") {
    parsedUrl.port = "";
  }
  if (parsedUrl.protocol === "https:" && parsedUrl.port === "443") {
    parsedUrl.port = "";
  }

  // Remove trailing slash if the option is set to true and there is no file-ending
  if (options.removeTrailingSlash && !parsedUrl.pathname.match(/\.[^/\\]+$/)) {
    parsedUrl.pathname = parsedUrl.pathname.replace(/\/$/, "");
  }

  // Handle search parameters based on the selected option
  switch (options.searchParameters) {
    case "remove":
      parsedUrl.search = "";
      break;
    case "sort":
      let searchParams = new URLSearchParams(parsedUrl.search);
      searchParams.sort();
      parsedUrl.search = searchParams.toString();
      break;
    // "keep" or default option: do nothing
  }

  // Enforce HTTPS if the option is set to true
  if (options.enforceHttps) {
    parsedUrl.protocol = "https:";
  }

  return parsedUrl;
}

export function normalizeURL() {
  return getNormalizedURL(...arguments).href;
}
