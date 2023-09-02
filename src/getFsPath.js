import path from "path";

function getExtension(filename) {
  var ext = path.extname(filename || "").split(".");
  return ext[ext.length - 1];
}

const mime2ext = {
  "text/html": "html",
  "text/css": "css",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "application/javascript": "js",
  "application/pdf": "pdf",
  "application/opensearchdescription+xml": "xml",
  "application/rsd+xml": "xml",
  "application/xml": "xml",
};

export function getMimeType(str) {
  return (str || "").toLocaleLowerCase().split(";")[0];
}

function fixFilename(name) {
  const filename = name; //.replace(/%7C/g, "|");
  const ext = path.extname(filename);
  const basename = path.basename(filename, ext);

  const result = `${basename.slice(0, 240 - ext.length)}${ext}`;

  return result;
}

// https://stackoverflow.com/questions/70643383/which-mime-types-contain-charset-utf-8-directive
export function getFsPath(fsPath, mime) {
  const mimeExt = mime2ext[mime];
  // if (!mimeExt) {
  //   console.error("no ext for mime", mime);
  //   console.log("getFsPath", fsPath, mime);
  //   throw new Error(`No extension for mime type ${mime}`);
  // }

  const url = new URL(fsPath);
  const pathname = url.pathname;
  url.searchParams.sort();
  const params = new URLSearchParams(url.search).toString(); // ?.sort()?.toString() || "";

  const dirname = path.dirname(pathname);
  // const basename = path.basename(pathname, path.extname(pathname));

  const fsExt = getExtension(pathname);
  const ext = fsExt || mimeExt;

  const basename = path.basename(pathname, `.${ext}`);

  let result = `${url.hostname}`;

  if (pathname.endsWith("/") && mimeExt === "html") {
    return `${result}${pathname}index.html`;
  }

  const filename = `${basename}${
    params ? `?${decodeURIComponent(params)}` : ""
  }.${ext}`;

  result = `${result}${dirname ? `${dirname}/` : ""}${fixFilename(filename)}`;

  return result;
}
