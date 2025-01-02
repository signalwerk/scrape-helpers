import { UrlPatcher } from "./UrlPatcher.js";

describe("UrlPatcher", () => {
  let patcher;

  beforeEach(() => {
    patcher = new UrlPatcher();
  });

  test("returns original URL when no rules are defined", () => {
    const url = "https://example.com/path";
    expect(patcher.patch(url)).toBe(url);
  });

  test("throws error when URL is empty", () => {
    // without a rule no patching is done
    patcher.addRule({
      transform: (url) => {
        url.pathname = url.pathname.toUpperCase();
        return url;
      },
    });

    expect(() => patcher.patch()).toThrow("No URL to patch");
    expect(() => patcher.patch("")).toThrow("No URL to patch");
  });

  test("applies transform function to matching URLs", () => {
    patcher.addRule({
      transform: (url) => {
        url.pathname = url.pathname.toUpperCase();
        return url;
      },
      includes: [/\/path$/],
    });

    const result = patcher.patch("https://example.com/path");
    expect(result).toBe("https://example.com/PATH");

    const resultNotMatching = patcher.patch("https://example.com/blog");
    expect(resultNotMatching).toBe(resultNotMatching);
  });

  test("skips transform for non-matching includes", () => {
    patcher.addRule({
      transform: (url) => {
        url.pathname = url.pathname.toUpperCase();
        return url;
      },
      includes: ["/other"],
    });

    const url = "https://example.com/path";
    expect(patcher.patch(url)).toBe(url);
  });

  test("skips transform for matching excludes", () => {
    patcher.addRule({
      transform: (url) => {
        url.pathname = url.pathname.toUpperCase();
        return url;
      },
      excludes: [/\/path$/],
    });

    const url = "https://example.com/path";
    expect(patcher.patch(url)).toBe(url);

    const resultNotMatching = patcher.patch("https://example.com/blog");
    expect(resultNotMatching).toBe("https://example.com/BLOG");
  });

  test("handles regex patterns in includes", () => {
    patcher.addRule({
      transform: (url) => {
        url.pathname += "index.html";
        return url;
      },
      includes: [/\/$/],
    });

    const result = patcher.patch("https://example.com/blog/");
    expect(result).toBe("https://example.com/blog/index.html");

    const resultNotMatching = patcher.patch("https://example.com/blog");
    expect(resultNotMatching).toBe(resultNotMatching);
  });

  test("handles regex patterns in excludes", () => {
    patcher.addRule({
      transform: (url) => {
        url.pathname = url.pathname.toUpperCase();
        return url;
      },
      excludes: [/\.html$/],
    });

    const url = "https://example.com/page.html";
    expect(patcher.patch(url)).toBe(url);

    const resultNotMatching = patcher.patch("https://example.com/blog");
    expect(resultNotMatching).toBe("https://example.com/BLOG");
  });

  test("applies multiple rules in sequence", () => {
    patcher
      .addRule({
        transform: (url) => {
          url.pathname = url.pathname.toUpperCase();
          return url;
        },
      })
      .addRule({
        transform: (url) => {
          url.pathname += ".html";
          return url;
        },
      });

    const result = patcher.patch("https://example.com/path");
    expect(result).toBe("https://example.com/PATH.html");
  });

  test("passes mime type to transform function", () => {
    patcher.addRule({
      transform: (url, mime) => {
        if (mime === "text/html") {
          url.pathname += "index.html";
        }
        return url;
      },
      includes: [/\/$/],
    });

    const result = patcher.patch("https://example.com/blog/", "text/html");
    expect(result).toBe("https://example.com/blog/index.html");
  });

  test("handles URL with query parameters", () => {
    patcher.addRule({
      transform: (url) => {
        // Sort query parameters
        const sorted = new URLSearchParams(
          [...url.searchParams.entries()].sort((a, b) =>
            a[0].localeCompare(b[0]),
          ),
        );
        url.search = sorted.toString();
        return url;
      },
    });

    const result = patcher.patch("https://example.com/path?z=3&a=1&b=2");
    expect(result).toBe("https://example.com/path?a=1&b=2&z=3");
  });
});
