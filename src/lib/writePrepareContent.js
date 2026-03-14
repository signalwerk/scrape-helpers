import { getMimeWithoutEncoding } from "./mime.js";

const textMimeTypes = new Set([
  "application/xhtml+xml",
  "text/css",
  "text/html",
]);

export function writePrepareContent() {
  return async (context, logger) => {
    const { headers, data } = context;
    const contentType =
      headers?.["content-type"] || context.mimeType || "application/octet-stream";
    const writeMimeType =
      getMimeWithoutEncoding(contentType) || "application/octet-stream";

    if (!data) {
      return {
        ...context,
        contentType,
        writeMimeType,
        written: false,
        skipWrite: true,
      };
    }

    return {
      ...context,
      contentType,
      writeMimeType,
      outputData: data,
      textContent: textMimeTypes.has(writeMimeType)
        ? Buffer.isBuffer(data)
          ? data.toString()
          : `${data}`
        : undefined,
      skipWrite: false,
    };
  };
}
