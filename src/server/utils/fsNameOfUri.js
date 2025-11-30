import { URL } from "url";

export function fsNameOfUri(uri, rootName = "---root") {
  const parsedUrl = new URL(uri);
  let queryParams = new URLSearchParams(parsedUrl.search);
  let sortedQuery = queryParams.toString();

  let path = [
    `${parsedUrl.protocol.replace(":", "")}/`,
    `${parsedUrl.host}`,
    parsedUrl.pathname.replace(/[:]/g, (str) => encodeURIComponent(str)),
  ]
    .filter(Boolean)
    .join("")
    // replace multiple slashes with encoded slashes (minus one slash) followed by slash
    .replace(/\/{2,}/g, (match) => `${encodeURIComponent(match.slice(1))}/`);

  // Append '---root' if the original URI ends with a slash
  if (path.endsWith("/") && rootName) {
    path += rootName;
  }

  const fileName = `${path}${
    sortedQuery ? encodeURIComponent(`?${sortedQuery}`) : ""
  }`;
  return fileName;
}

// console.log(
//   fsNameOfUri(
//     "https://web.archive.org/web/20070629085608im_/http://www.libregraphicsmeeting.org/2007/",
//     "---root",
//   ),
// );
// console.log(
//   fsNameOfUri(
//     "https://libregraphicsmeeting.org/2007",
//     "---root",
//   ),
// );
