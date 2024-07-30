import cheerio from "cheerio";
import fs from "fs";
import util from "util";
import postcss from "postcss";
import { absoluteUrl, getNormalizedURL } from "../normalizeURL.js";
import { isDomainAllowed, isRecected } from "./download.js";
import "../cleanups/getRelativeURL.js";

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

const urlRegex = /url\(['"]?([^'"]+)['"]?\)/g;

function findResources() {
  return new Promise((resolve) => {
    const resources = {
      imports: [],
      backgroundImages: [],
      fonts: [],
    };

    const plugin = () => {
      return {
        postcssPlugin: "postcss-find-resources",

        Once(root) {
          root.walkAtRules("import", (rule) => {
            resources.imports.push(rule.params.replace(/['";]/g, ""));
          });

          root.walkAtRules("font-face", (rule) => {
            rule.walkDecls("src", (decl) => {
              let match;

              while ((match = urlRegex.exec(decl.value)) !== null) {
                resources.fonts.push(match[1]);
              }
            });
          });

          root.walkDecls((decl) => {
            let match;

            // Common properties that may contain URLs
            const propsWithUrls = [
              "background",
              "background-image",
              "cursor",
              "list-style",
              "list-style-image",
              "mask",
              "mask-image",
            ];

            if (propsWithUrls.includes(decl.prop)) {
              while ((match = urlRegex.exec(decl.value)) !== null) {
                resources.backgroundImages.push(match[1]);
              }
            }
          });
        },
      };
    };
    plugin.postcss = true;

    resolve({ plugin, resources });
  });
}

export async function processFile({
  typesToDownload,
  appendToLog,
  processProgress,
  processQueue,
  downloadQueue,
  downloadProgress,
  processedUrls,
  process,
}) {
  while (processQueue.length > 0) {
    appendToLog(`START processFile:`);

    const next = processQueue.shift();

    const { redirect, url, path, mimeType } = next;

    const urlRoot = redirect?.url || url;

    appendToLog(`START processFile: ${url}`);
    if (redirect?.url) {
      appendToLog(`                   Redirected: ${urlRoot}`);
    }
    appendToLog(`                   ${mimeType} ${path}`);

    let hasEdits = false;
    const content = await readFile(path, "utf-8");

    if (mimeType === "text/html") {
      const $ = cheerio.load(content);

      let baseTagHref = $("base")?.attr("href") || ".";

      // Modified processElements function
      function processElements(selector, attribute) {
        $(selector).each((index, element) => {
          let originalValue = $(element).attr(attribute);

          if (originalValue) {
            if (attribute === "srcset") {
              // Split by comma to get individual URLs in srcset
              const srcsetUrls = originalValue.split(",");
              srcsetUrls.forEach((srcsetUrl) => {
                // Trim and split by space to separate URL and pixel density descriptor
                const [srcsetUrlTrimmed] = srcsetUrl.trim().split(" ");
                const fullUrl = absoluteUrl(
                  srcsetUrlTrimmed,
                  urlRoot,
                  baseTagHref,
                );
                addUrlToQueue(fullUrl);
              });
            } else {
              const fullUrl = absoluteUrl(originalValue, urlRoot, baseTagHref);
              addUrlToQueue(fullUrl);
            }
          }
        });
      }

      // Function to add URL to download queue
      function addUrlToQueue(fullUrl) {
        if (!downloadQueue.includes(fullUrl) && !processedUrls[fullUrl]) {
          appendToLog(`  Append download (html): ${fullUrl} (from ${url})`);
          downloadQueue.push(fullUrl);
          downloadProgress.setTotal(downloadProgress.total + 1);
        }
      }

      // // Process anchor links
      processElements("a", "href");

      // Process images if needed
      if (typesToDownload.includes("image")) {
        processElements("img", "src");
        processElements("img", "srcset"); // Handling srcset for img
        processElements("source", "srcset"); // Handling srcset for img
      }

      // Process scripts if needed
      if (typesToDownload.includes("script")) {
        processElements("script", "src");
      }

      if (typesToDownload.includes("stylesheet")) {
        processElements("link[rel=stylesheet]", "href");
      }

      if (typesToDownload.includes("icon")) {
        processElements("link[rel=icon]", "href");
      }

      if (process && process["text/html"]) {
        await process["text/html"](
          { url: urlRoot, path, appendToLog },
          (urls) => {
            urls.forEach((fullUrl) => {
              addUrlToQueue(fullUrl);
            });
          },
        );
      }
    }
    if (mimeType === "text/css") {
      const { plugin, resources } = await findResources();

      // Use PostCSS to parse and handle the CSS
      postcss([plugin])
        .process(content, {
          // Explicitly set the `from` option to `undefined` to prevent
          // sourcemap warnings which aren't relevant to this use case.
          from: undefined,
        })
        .then(() => {
          resources.backgroundImages.forEach((originalUrl) => {
            // const fullUrl = absoluteUrl(originalUrl, url);

            const fullUrl = getNormalizedURL(originalUrl, url, {
              removeHash: true,
              searchParameters: "remove",
            }).href;

            appendToLog(`  Append download (css): ${fullUrl} (from ${url})`);

            downloadQueue.push(fullUrl);
            downloadProgress.setTotal(downloadProgress.total + 1);
          });
          resources.fonts.forEach((originalUrl) => {
            const fullUrl = getNormalizedURL(originalUrl, url, {
              removeHash: true,
              searchParameters: "remove",
            }).href;

            appendToLog(`  Append download (font): ${fullUrl} (from ${url})`);

            downloadQueue.push(fullUrl);
            downloadProgress.setTotal(downloadProgress.total + 1);
          });
        })
        .catch((err) => {
          console.error("Error processing the CSS:", err);
        });
    }

    processProgress.increment();
  }
}
