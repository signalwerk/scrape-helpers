import { Cache } from "./Cache.js";
import axios from "axios";
import { v4 as uuid } from "uuid";
import { RedirectError } from "./FlowControlError.js";


export function fetchHttp({ url, path, proxy, cacheKey }) {
  const fetchUrl = proxy || url;

  return async (context, logger) => {
    if (context.cached) {
      logger.log(`Skipping fetch, using cached data for ${url}`, {
        fromCache: true,
      });
      return context;
    }

    const cache = new Cache(path);

    logger.log(`Fetching ${url} (from ${fetchUrl})`);

    try {
      const response = await axios.get(fetchUrl, {
        responseType: "arraybuffer",
        maxRedirects: 0,
      });

      const metadata = {
        headers: response.headers,
        status: response.status,
        uri: fetchUrl,
        timestamp: new Date().toISOString(),
      };

      await cache.set(cacheKey, {
        metadata,
        data: response.data,
      });

      logger.log(`Saved response to cache for ${url} (from ${fetchUrl})`, {
        statusCode: response.status,
        mimeType: response.headers["content-type"],
      });

      return {
        ...context,
        response: {
          status: response.status,
          headers: response.headers,
          data: response.data,
        },
      };
    } catch (axiosError) {
      if (
        axiosError.response &&
        (axiosError.response.status === 302 ||
          axiosError.response.status === 301)

        // axiosError.response &&
        // axiosError.response.status >= 300 &&
        // axiosError.response.status < 400
      ) {
        const newUri = axiosError.response.headers.location;

        if (!newUri) {
          throw new Error(
            `Unexpected redirect without location header: ${url} (from ${fetchUrl})`,
          );
        }

        if (proxy && url !== proxy) {
          throw new Error(
            `Redirect for proxy request not supported: ${url} (from ${fetchUrl})`,
          );
        }

        const metadata = {
          headers: axiosError.response.headers,
          status: axiosError.response.status,
          uri: fetchUrl,
          redirected: newUri,
          timestamp: new Date().toISOString(),
        };

        await cache.set(cacheKey, { metadata });
        logger.log(
          `Saved redirect metadata to cache for ${url} (from ${fetchUrl})`,
          {
            statusCode: axiosError.response.status,
            redirectTo: newUri,
          },
        );

        // Add redirect to request queue with incremented counter

        context.addToQueue("request", {
          url: newUri,
          redirects: (context.redirects || 0) + 1,
          id: uuid(),
          addedAt: new Date().toISOString(),
          parentId: context.id, // Track the parent that initiated this redirect
        });

        // Mark as completed and stop processing with RedirectError
        context.complete();
        throw new RedirectError(`HTTP redirect to ${newUri}`);
      }

      const statusCode = axiosError.response?.status;
      const statusText = axiosError.response?.statusText;

      const metadata = {
        headers: axiosError.response?.headers,
        status: statusCode,
        uri: fetchUrl,
        error: statusCode,
        timestamp: new Date().toISOString(),
      };

      await cache.set(cacheKey, { metadata });

      const errorMessage = `Request failed. Status: ${statusCode || "unknown"} Text: ${statusText || "unknown"} Message: ${axiosError.message || "unknown"}`;

      logger.error(`Saved error to cache for ${fetchUrl}`, {
        statusCode,
        error: errorMessage,
      });

      throw new Error(errorMessage);
    }
  };
}
