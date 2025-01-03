// based on
// https://gist.github.com/m93a/2553dd45de35aa05d0233c6f9dc04bc2

/**
 * Rewrite this URL as an URL relative to the base.
 *
 * @parameter {URL|string} url        The URL to make relative
 * @parameter {URL|string} base       The resulting URL will be relative to this one.
 * @parameter {bool=false} [reload]   `false` to use "#" whenever the path and query of this url and the base are equal,
 *                                    `true` to use filename or query (forces reload in browsers)
 * @parameter {bool|undefined} [root] `true` to force root-relative paths (eg. "/dir/file"),
 *                                    `false` to force directory-relative paths (eg. "../file"),
 *                                    `undefined` to always use the shorter one.
 * @parameter {bool|string} [dotSlash] Optional, whether or not to include the "./" in relative paths.
 *                                    If the value is "force", it will be included even before "../".
 */
export function getRelativeURL(url, base, reload = false, root, dotSlash) {
  try {
    url = new URL(url);
  } catch (e) {
    throw new Error("Invalid URL");
  }

  try {
    base = new URL(base);
  } catch (e) {
    base = new URL(document.URL);
  }

  dotSlash === "force" || (dotSlash = !!dotSlash);
  root === undefined || (root = !!root);

  let rel = "";

  if (url.protocol !== base.protocol) {
    return url.href;
  }

  if (
    url.host !== base.host ||
    url.username !== base.username ||
    url.password !== base.password
  ) {
    rel = "//";

    if (url.username) {
      rel += url.username;
      if (url.password) rel += ":" + url.password;
      rel += "@";
    }

    rel += url.host;
    rel += url.pathname;
    rel += url.search;
    rel += url.hash;

    return rel;
  }

  if (url.pathname !== base.pathname) {
    if (root) {
      rel = url.pathname;
    } else {
      const thisPath = url.pathname.split("/");
      const basePath = base.pathname.split("/");
      const tl = thisPath.length;
      const bl = basePath.length;

      for (var i = 1, l = Math.min(tl, bl) - 1; i < l; i++) {
        if (thisPath[i] !== basePath[i]) {
          break;
        }
      }

      for (var cd = bl - 1; cd > i; cd--) {
        if (!rel && dotSlash === "force") {
          rel += "./";
        }
        rel += "../";
      }

      if (dotSlash && !rel) rel += "./";

      for (l = tl; i < l; i++) {
        rel += thisPath[i];
        if (i !== l - 1) {
          rel += "/";
        }
      }

      if (root !== false && rel.length > url.pathname.length) {
        rel = url.pathname;
      }

      if (!rel && basePath[basePath.length - 1]) {
        rel = "./";
      }
    }
  }

  if (rel || url.search !== base.search) {
    rel += url.search;
    rel += url.hash;
  }

  if (!rel) {
    if (reload) {
      rel = url.search || "?";
      rel += url.hash;
    } else {
      rel = url.hash || "#";
    }
  }

  return rel;
}
