import { absoluteUrl } from "../lib/absoluteUrl.js";
import { processURL } from "../lib/processURL.js";

const htmlMimeTypes = new Set(["application/xhtml+xml", "text/html"]);

export function writeRewriteHtml({
  htmlProcessors = {},
  rewriteUrl,
} = {}) {
  return async (context, logger) => {
    if (context.skipWrite || !htmlMimeTypes.has(context.writeMimeType)) {
      return context;
    }

    if (!context.$) {
      return context;
    }

    const $ = context.$;
    const htmlProcessor = htmlProcessors[context.writeMimeType];

    if (htmlProcessor) {
      htmlProcessor($);
      logger.log(`Applied HTML transformations for ${context.normalizedUrl}`);
    }

    const baseUrl =
      absoluteUrl($("base")?.attr("href") || "", context.normalizedUrl) ||
      context.normalizedUrl;

    await processURL({
      $,
      cb: (url) => rewriteUrl?.({ url, baseUrl, context, logger }) || url,
    });

    return {
      ...context,
      textContent: $.html(),
    };
  };
}
