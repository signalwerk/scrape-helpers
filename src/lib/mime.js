const mime2ext = {
  "text/html": "html",
  "text/css": "css",
  "text/javascript": "js",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/x-icon": "ico",
  "application/javascript": "js",
  "application/pdf": "pdf",
  "application/opensearchdescription+xml": "xml",
  "application/rsd+xml": "xml",
  "application/xml": "xml",
  "font/woff": "woff",
};

// Helper function to extract MIME type without encoding
export function getMimeWithoutEncoding(mimeType) {
  if (!mimeType) return null;
  return mimeType.split(";")[0].trim();
}

export function getExtensionOfMime(mime) {
  return mime2ext[getMimeWithoutEncoding(mime)];
}

export function guessMimeType({ headers, first100Bytes, logger }) {
  let mimeType = headers?.["content-type"];

  if (mimeType) {
    logger?.log(`Found mime type in headers: ${mimeType}`);
  } else {
    logger?.log("No mime type found in headers, guessing...");

    if (first100Bytes) {
      // check if the header looks like a html file
      if (first100Bytes.includes("<html")) {
        logger?.log("Guessing mime type as text/html");
        mimeType = "text/html";
      }
    }
  }

  return getMimeWithoutEncoding(mimeType);
}
