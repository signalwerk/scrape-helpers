import { normalizeUrl } from "./normalizeUrl.js";

export function requestNormalizeUrl() {
  return async (context, logger) => {
    const normalizedUrl = normalizeUrl({
      url: context.parsedUrl,
      remove: ["hash"],
      logger,
    });
    logger.log(`Normalized URL: ${normalizedUrl}`);
    return { ...context, normalizedUrl };
  };
}
