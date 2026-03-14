const textMimeTypes = new Set([
  "application/xhtml+xml",
  "text/css",
  "text/html",
]);

export function writeFinalizeContent() {
  return async (context, logger) => {
    if (
      context.skipWrite ||
      !textMimeTypes.has(context.writeMimeType) ||
      typeof context.textContent !== "string"
    ) {
      return context;
    }

    return {
      ...context,
      outputData: Buffer.from(context.textContent, "utf8"),
    };
  };
}
