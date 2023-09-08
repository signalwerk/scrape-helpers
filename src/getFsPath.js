import path from "path";

function getExtension(filename) {
  var ext = path.extname(filename || "").split(".");
  return ext[ext.length - 1];
}

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
};

// Configuration for equivalent extensions
const equivalentExtensions = [
  ["jpg", "jpeg"],
  ["htm", "html"],

  // Add more equivalent pairs here
  // ["ext1", "ext2"],
];

// Utility function to normalize extension based on the configuration
function normalizeExtension(extension) {
  // Convert to lowercase first
  const lowerCaseExt = extension.toLowerCase();

  // Check if this extension has an equivalent
  for (const pair of equivalentExtensions) {
    if (pair.includes(lowerCaseExt)) {
      return pair[0]; // Always return the first item as the 'normalized' version
    }
  }

  return lowerCaseExt; // If no equivalent found, return as is
}

function sameExtension(fsExt, mimeExt) {
  // Normalize extensions
  const normalizedFsExt = normalizeExtension(fsExt);
  const normalizedMimeExt = normalizeExtension(mimeExt);

  return normalizedFsExt === normalizedMimeExt;
}

export function getMimeType(str) {
  return (str || "").toLocaleLowerCase().split(";")[0];
}

function fixFilename(name) {
  const filename = name; // .replaceAll("%7C", "|");
  const ext = path.extname(filename);
  const basename = decodeURI(path.basename(filename, ext));

  const result = `${basename.slice(0, 240 - ext.length)}${ext}`;

  return result;
}

// https://stackoverflow.com/questions/70643383/which-mime-types-contain-charset-utf-8-directive
export function getFsPath(fsPath, mime) {
  const mimeExt = mime2ext[mime];

  const url = new URL(fsPath);
  const pathname = url.pathname;
  url.searchParams.sort();
  const params = new URLSearchParams(url.search).toString(); // ?.sort()?.toString() || "";

  const dirname = path.dirname(pathname);
  // const basename = path.basename(pathname, path.extname(pathname));

  const fsExt = getExtension(pathname);
  const ext = mimeExt || fsExt;

  const basename = path.basename(pathname);
  const hasExt = basename.endsWith(`.${fsExt}`);

  let result = `${url.hostname}`;

  if (pathname.endsWith("/") && mimeExt === "html") {
    return `${result}${pathname}index.html`;
  }

  let filename = null;

  if ((hasExt && sameExtension(fsExt, mimeExt)) || params) {
    filename = basename;
  } else {
    filename = `${basename}.${ext}`;
  }

  if (params) {
    filename += `?${decodeURIComponent(params)}.${ext}`;
  }

  if (dirname && dirname !== "/") {
    result += `${dirname}`;
  }

  result += `/${fixFilename(filename)}`;

  return result;
}
