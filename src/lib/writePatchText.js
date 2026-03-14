const textMimeTypes = new Set([
  "application/xhtml+xml",
  "text/css",
  "text/html",
]);

export function writePatchText({ dataPatcher } = {}) {
  return async (context, logger) => {
    if (
      context.skipWrite ||
      !textMimeTypes.has(context.writeMimeType) ||
      typeof context.textContent !== "string"
    ) {
      return context;
    }

    const textContent = dataPatcher
      ? dataPatcher.patch(context.normalizedUrl, context.textContent, logger)
      : context.textContent;

    logger.log(`Applied data patches for ${context.normalizedUrl}`);

    return {
      ...context,
      textContent,
    };
  };
}
