export async function processElements({ $, cb }, next) {
  // Process all elements with a single call
  const configurations = [
    // Navigation and links
    { selector: "a", attribute: "href" },
    { selector: "area", attribute: "href" },

    // Media elements
    { selector: "img", attribute: "src" },
    { selector: "img", attribute: "srcset", splitOnComma: true },
    { selector: "source", attribute: "src" },
    { selector: "source", attribute: "srcset", splitOnComma: true },
    { selector: "video", attribute: "src" },
    { selector: "video", attribute: "poster" },
    { selector: "audio", attribute: "src" },
    { selector: "track", attribute: "src" },

    // Resource links
    { selector: "script", attribute: "src" },
    { selector: "link[rel=stylesheet]", attribute: "href" },

    // Link relations
    { selector: "link[rel=icon]", attribute: "href" },
    { selector: "link[rel='shortcut icon']", attribute: "href" },
    { selector: "link[rel=apple-touch-icon]", attribute: "href" },
    { selector: "link[rel=alternate]", attribute: "href" },
    { selector: "link[rel=amphtml]", attribute: "href" }, // Accelerated Mobile Pages
    { selector: "link[rel=canonical]", attribute: "href" },
    { selector: "link[rel=manifest]", attribute: "href" },
    { selector: "link[rel=search]", attribute: "href" },
    { selector: "link[rel=pingback]", attribute: "href" },

    // Resource hints
    { selector: "link[rel=preload]", attribute: "href" },
    { selector: "link[rel=preload]", attribute: "imagesrcset" },

    { selector: "link[rel=prefetch]", attribute: "href" },
    { selector: "link[rel=preconnect]", attribute: "href" },
    { selector: "link[rel=dns-prefetch]", attribute: "href" },

    // Embedded content
    { selector: "iframe", attribute: "src" },
    { selector: "embed", attribute: "src" },
    { selector: "object", attribute: "data" },

    // Forms
    // { selector: "form", attribute: "action" },
    // Meta tags
    { selector: "meta[http-equiv=refresh]", attribute: "content" },
    { selector: "meta[property='og:image']", attribute: "content" },
    { selector: "meta[property='og:url']", attribute: "content" },
    { selector: "meta[property='og:audio']", attribute: "content" },
    { selector: "meta[property='og:video']", attribute: "content" },
    { selector: "meta[name='twitter:image']", attribute: "content" },
    { selector: "meta[name='msapplication-TileImage']", attribute: "content" },
    { selector: "meta[name='thumbnail']", attribute: "content" },
    { selector: "meta[itemprop='image']", attribute: "content" },
  ];

  configurations.forEach(({ selector, attribute, splitOnComma = false }) => {
    $(selector).each((index, element) => {
      let originalValue = $(element).attr(attribute);

      if (!originalValue) return;

      // Use splitOnComma flag from configuration
      const urls = splitOnComma
        ? originalValue.split(",").map((part) => {
            const [url, ...descriptors] = part.trim().split(/\s+/);
            return { url, descriptors: descriptors.join(" ") };
          })
        : [{ url: originalValue, descriptors: "" }];

      const newURLs = [];

      urls.forEach(({ url, descriptors }) => {
        if (cb) {
          const newURL = cb(url);
          if (newURL) {
            newURLs.push(descriptors ? `${newURL} ${descriptors}` : newURL);
          }
        }
      });

      if (newURLs.length > 0) {
        $(element).attr(attribute, newURLs.join(", "));
      }
    });
  });
}
