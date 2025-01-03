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

export function getMimeWithoutEncoding(mime) {
  return mime?.split(";")?.[0] || "";
}

export function getExtensionOfMime(mime) {
  return mime2ext[getMimeWithoutEncoding(mime)];
}
