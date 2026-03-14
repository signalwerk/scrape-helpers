import { parseCss } from "../lib/parse.js";
import { getMimeWithoutEncoding } from "./mime.js";

const cssMimeTypes = new Set(["text/css"]);

export function parseProcessCss({ dataPatcher } = {}) {
  return async (context, logger) => {
    if (context.parsed !== undefined) {
      return context;
    }

    const mimeType = getMimeWithoutEncoding(context.mimeType);

    if (!cssMimeTypes.has(mimeType)) {
      return context;
    }

    logger.log(`Starting parse for ${context.normalizedUrl}`);
    logger.log(`Parsing content with MIME type: ${mimeType}`, {
      mimeType,
    });

    const dataString = Buffer.isBuffer(context.data)
      ? context.data.toString()
      : context.data;

    try {
      const patchedData = dataPatcher
        ? dataPatcher.patch(context.parsedUrl.pathname, dataString, logger)
        : dataString;

      await parseCss(context, logger, patchedData);

      return {
        ...context,
        parsed: true,
        parsedAt: new Date().toISOString(),
      };
    } catch (parseError) {
      logger.error(
        `Parse error for ${context.normalizedUrl}: ${parseError.message}`,
        {
          error: parseError.message,
          mimeType,
          parseStage: "content-parsing",
        },
      );

      return {
        ...context,
        parsed: false,
        parseError: parseError.message,
        parsedAt: new Date().toISOString(),
      };
    }
  };
}
