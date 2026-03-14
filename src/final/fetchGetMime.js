import { guessMimeType } from "./mime.js";

export function fetchGetMime() {
  return async (context, logger) => {
    let headers, data;

    if (context.cached && context.cachedData) {
      // Use cached data
      headers = context.cachedData.metadata?.headers;
      data = context.cachedData.data;
    } else {
      // Use response data
      headers = context.response?.headers;
      data = context.response?.data;
    }

    const mimeType = guessMimeType({
      headers,
      first100Bytes: data?.slice(0, 100),
      logger,
    });

    return {
      ...context,
      mimeType,
    };
  };
}
