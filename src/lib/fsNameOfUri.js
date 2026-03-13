import path from "path";
import { URL } from "url";
import { getExtensionOfMime } from "./mime.js";
import { UrlPatcher } from "./UrlPatcher.js";

// Configuration for equivalent extensions
const equivalentExtensions = [
  ["jpg", "jpeg"],
  ["htm", "html"],
  // Add more equivalent pairs here
  // ["ext1", "ext2"],
];

export function getExtension(filename) {
  var ext = path.extname(filename || "").split(".");
  return ext[ext.length - 1];
}
// Utility function to normalize extension based on the configuration
function normalizeExtension(extension) {
  if (!extension) {
    return extension;
  }

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
export function sameExtension(fsExt, mimeExt) {
  // Normalize extensions
  const normalizedFsExt = normalizeExtension(fsExt);
  const normalizedMimeExt = normalizeExtension(mimeExt);

  return normalizedFsExt === normalizedMimeExt;
}

export function fixFilename(pathname) {
  if (!pathname) {
    return pathname;
  }
  if (pathname.length < 240) {
    return pathname;
  }

  const dirname = path.dirname(pathname);
  const ext = path.extname(pathname);
  const basename = path.basename(pathname, ext);

  const result = path.join(
    dirname,
    `${basename.slice(0, 240 - ext.length)}${ext}`,
  );

  return result;
}


export function fsCacheNameOfUri(uri, rootName = "---root") {
  try {
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
  } catch (error) {
    console.error(`Error in fsCacheNameOfUri (${uri}):`, error);
    throw error;
  }
}

const defaultURLPatcher = new UrlPatcher();
defaultURLPatcher
  .addRule({
    // adjust http & https to file
    transform: (url) => {
      url.protocol = "file";
      return url;
    },
    includes: [/^http(s)?:\/\//],
  })
  .addRule({
    // Add index.html to the end of the pathname if it ends with a slash
    transform: (url, data) => {
      url.pathname += "index";
      return [url, { ...data, fsExt: "html" }];
    },
    includes: [/\/$/],
  })
  .addRule({
    // Sort query params
    transform: (url) => {
      url.search = new URLSearchParams(
        [...new URLSearchParams(url.search).entries()].sort((a, b) =>
          a[0].localeCompare(b[0]),
        ),
      ).toString();
      return url;
    },
  })
  .addRule({
    // detect the extension from the pathname
    transform: (url, data) => {
      const fsExt = getExtension(url.pathname) || "";

      if (fsExt) {
        return [
          url,
          {
            ...data,
            fsExt,
          },
        ];
      }

      return [url, { ...data, fsExt }];
    },
    excludes: [/\/$/],
  })

  .addRule({
    // add search params to the pathname and fix file extension
    transform: (url, data) => {
      const imgExts = ["png", "jpeg", "gif", "svg"];

      if ([imgExts].includes(data.mimeExt) || imgExts.includes(data.fsExt)) {
        url.search = "";
      }
      return [url, data];
    },
  })
  .addRule({
    // add search params to the pathname and fix file extension
    transform: (url, data) => {
      if (url.search) {
        url.pathname += url.search.replaceAll(
          "?",
          encodeURIComponent(encodeURIComponent("?")), // encode the question mark to %3F
        );
        url.search = "";

        // If there is a search, we need to add the extension
        if (data.mimeExt) {
          url.pathname += `.${data.mimeExt}`;
        } else if (data.fsExt) {
          url.pathname += `.${data.fsExt}`;
        }
      } else {
        if (!sameExtension(data.fsExt, data.mimeExt)) {
          if (data.mimeExt) {
            url.pathname += `.${data.mimeExt}`;
          }
        }
      }

      return url;
    },
  })
  .addRule({
    // fix filename length
    transform: (url, data) => {
      url.pathname = fixFilename(url.pathname);
      return url;
    },
  });

export function fsReadyNameOfUri(uri, rootName = "index", mime = null) {
  try {
    const parsedUrl = new URL(uri);

    // Append rootName if the original URI ends with a slash
    if (parsedUrl.pathname.endsWith("/") && rootName) {
      parsedUrl.pathname += rootName;
    }

    if (parsedUrl.pathname && mime) {
      const mimeExt = getExtensionOfMime(mime) || "";

      if (mimeExt) {
        parsedUrl.pathname += `.${mimeExt}`;
      }
    }

    return parsedUrl.toString();
  } catch (error) {
    console.error(`Error in fsReadyNameOfUri (${uri}):`, error);
    throw error;
  }
}

export function fsNameOfUri({ uri, mime, patcher = defaultURLPatcher }) {
  try {
    const mimeExt = getExtensionOfMime(mime);
    let url = patcher.patch(uri, { mimeExt });

    let result = decodeURIComponent(url);

    return result.replace(/^file:\/\//, ""); // Remove file:// protocol for filesystem paths
  } catch (error) {
    console.error(`Error in fsNameOfUri (${uri}):`, error);
    throw error;
  }
}
