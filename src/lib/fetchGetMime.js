import { guessMimeType } from "./mime.js";

export function fetchGetMime() {
  return async (context, logger) => {
    let { headers, data } = context;

    const mimeType = guessMimeType({
      headers,
      first100Bytes: data?.slice(0, 100),
      logger,
    });

    return {
      ...context,
      mimeType
    };
  };
}
