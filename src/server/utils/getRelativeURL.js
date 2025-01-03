// https://gist.github.com/m93a/2553dd45de35aa05d0233c6f9dc04bc2

/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

(function () {
  /**
   * Rewrite this URL as an URL relative to the base.
   * TODO: Doesn't support backslashes!
   *
   * @parameter {string|URL}  base       The resulting URL will be relative to this one.
   * @parameter {bool=false}  [reload]   `false` to use "#" whenever the path and query of this url and the base are equal,
   *                                     `true` to use filename or query (forces reload in browsers)
   * @parameter {bool|undefined} [root]  `true` to force root-relative paths (eg. "/dir/file"),
   *                                     `false` to force directory-relative paths (eg. "../file"),
   *                                     `undefined` to allways use the shorter one.
   * @parameter {bool|string} [dotSlash] Optional, whether or not to include the "./" in relative paths.
   *                                     If the value is "force", it will be included even before "../".
   */
  URL.prototype.getRelativeURL = function getRelativeURL(
    base,
    reload,
    root,
    dotSlash
  ) {
    reload = !!reload;
    dotSlash === "force" || (dotSlash = !!dotSlash);
    root === undefined || (root = !!root);

    try {
      base = new URL(base);
    } catch (e) {
      base = new URL(document.URL);
    }

    var rel = "";

    if (this.protocol !== base.protocol) {
      return this.href;
    }

    if (
      this.host !== base.host ||
      this.username !== base.username ||
      this.password !== base.password
    ) {
      rel = "//";

      if (this.username) {
        rel += this.username;
        if (this.password) rel += ":" + this.password;
        rel += "@";
      }

      rel += this.host;
      rel += this.pathname;
      rel += this.search;
      rel += this.hash;

      return rel;
    }

    if (this.pathname !== base.pathname) {
      if (root) {
        rel = this.pathname;
      } else {
        var thisPath = this.pathname.split("/");
        var basePath = base.pathname.split("/");
        var tl = thisPath.length;
        var bl = basePath.length;

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

        if (root !== false && rel.length > this.pathname.length) {
          rel = this.pathname;
        }

        if (!rel && basePath[basePath.length - 1]) {
          rel = "./";
        }
      }
    }

    if (rel || this.search !== base.search) {
      rel += this.search;
      rel += this.hash;
    }

    if (!rel) {
      if (reload) {
        rel = this.search || "?";
        rel += this.hash;
      } else {
        rel = this.hash || "#";
      }
    }
    return rel;
  };
})();
