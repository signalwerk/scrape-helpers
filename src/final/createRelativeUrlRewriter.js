import { absoluteUrl } from "../lib/absoluteUrl.js";
import { fsReadyNameOfUri } from "../lib/fsNameOfUri.js";
import { getRelativeURL } from "../lib/getRelativeURL.js";
import { normalizeUrl } from "./normalizeUrl.js";

function extractProtocolPortDomain(url) {
  try {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol;
    const port = urlObj.port ? `:${urlObj.port}` : "";
    const domain = urlObj.hostname;
    return `${protocol}//${domain}${port}`;
  } catch (error) {
    console.error(`Invalid URL (${url}):`, error);
    return null;
  }
}

export function createRelativeUrlRewriter({ mimeTypes } = {}) {
  if (!(mimeTypes instanceof Map)) {
    throw new Error("createRelativeUrlRewriter requires a Map of mime types");
  }

  return ({ url, baseUrl, logger }) => {
    const fullUrl = absoluteUrl(url, baseUrl);
    if (!fullUrl) {
      return;
    }

    const normalizedUrl = normalizeUrl({
      url: fullUrl,
      logger,
    });
    const normalizedUrlWithoutHash = normalizeUrl({
      url: fullUrl,
      remove: ["hash"],
      logger,
    });
    const normalizedBaseUrl = normalizeUrl({
      url: baseUrl,
      remove: ["hash"],
      logger,
    });
    const mime = mimeTypes.get(normalizedUrlWithoutHash) || null;

    if (!mime) {
      return url;
    }

    if (normalizedUrlWithoutHash === normalizedBaseUrl) {
      return getRelativeURL(
        normalizedUrlWithoutHash,
        extractProtocolPortDomain(normalizedBaseUrl),
        false,
        true,
        true,
      );
    }

    const fileAbsoluteUrl = fsReadyNameOfUri({
      uri: normalizedUrl,
      mime,
    });
    const fileBaseUrl = fsReadyNameOfUri({
      uri: normalizedBaseUrl,
      mime: mimeTypes.get(normalizedBaseUrl) || null,
    });

    return getRelativeURL(fileAbsoluteUrl, fileBaseUrl, true, false, true);
  };
}
