import { rewriteCss } from "../lib/rewrite.js";

export function writeRewriteCss({ rewriteUrl } = {}) {
  return async (context, logger) => {
    if (
      context.skipWrite ||
      context.writeMimeType !== "text/css" ||
      typeof context.textContent !== "string"
    ) {
      return context;
    }

    const textContent = await rewriteCss({
      context,
      logger,
      content: context.textContent,
      cb: (url) =>
        rewriteUrl?.({
          url,
          baseUrl: context.normalizedUrl,
          context,
          logger,
        }) || url,
    });

    return {
      ...context,
      textContent,
    };
  };
}
