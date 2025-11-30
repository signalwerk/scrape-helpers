import { v4 as uuid } from "uuid";
import * as cheerio from "cheerio";
import { absoluteUrl } from "./absoluteUrl.js";
import postcss from "postcss";
import { processElements } from "./processElements.js";
import { stripStyleComments } from "./styleUtils.js";

export function parseFiles() {
  return async ({ job, context }, next) => {
    const { data: dataFromCache, metadata } = context.cache.get(
      job.data.cache.key,
    );

    const data = context.dataPatcher.patch(
      job.data.uri,
      `${dataFromCache}`,
      (log) => job.log(log),
    );

    if (!metadata) {
      throw new Error(
        `No data or metadata found in cache ${job.data.cache.key}`,
      );
    }

    if (!data) {
      job.log("No data found in cache");
      next();
      return;
    }

    const mimeType = job.data.mimeType;

    switch (mimeType) {
      case "application/xhtml+xml":
      case "text/html": {
        await parseHtml({ job, events: context.events, data }, next);
        break;
      }
      case "text/css": {
        await parseCss({ job, events: context.events, data }, next);
        break;
      }
      default: {
        // we don't need to parse the other mime types
        break;
      }
    }

    next();
  };
}

export function guessMimeType() {
  return async ({ job, context }, next) => {
    const metadata = context.cache.getMetadata(job.data.cache.key);

    let mimeType = metadata.headers["content-type"];

    if (!mimeType) {
      job.log("No mime type found in metadata, guessing...");
      const data = context.cache.getData(job.data.cache.key);
      // read first 100 bytes
      const first100Bytes = data.slice(0, 100);

      // check if the header looks like a html file
      if (first100Bytes.includes("<html")) {
        job.log("Guessing mime type as text/html");
        mimeType = "text/html";
      }
    }

    job.data.mimeType = getMimeWithoutEncoding(mimeType);

    next();
  };
}

export function addParseJob() {
  return async ({ job, context }, next) => {
    try {
      // Add validation logic here for the URI or other request parameters
      if (!job.data.uri) {
        throw new Error("No URI provided");
      }

      if (job.error) {
        throw new Error(`Job has error: ${job.error} no need to parse`);
      }

      // Create a parse job with the validated data
      const parseJobData = {
        ...job.data,
        _parent: job.id,
      };

      context.events?.emit("createParseJob", parseJobData);
      job.log(`Created parse job – ${parseJobData.uri}`);

      job.log(`Created parse job request`);
      next();
    } catch (error) {
      throw new Error(`Error: ${error.message}`);
    }
  };
}

export async function parseCss(context, logger, cssData) {
  logger.log(`Parsing CSS content`);

  try {
    const { plugin, resources } = await findResources();

    // Process the CSS content using PostCSS
    await postcss([plugin])
      .process(cssData, { from: undefined })
      .then(() => {
        // Process @import rules
        resources.imports.forEach((originalUrl) => {
          const fullUrl = absoluteUrl(originalUrl, context.normalizedUrl);
          if (!fullUrl) return;

          context.addToQueue("request", {
            url: fullUrl,
            redirects: 0,
            id: uuid(),
            addedAt: new Date().toISOString(),
          });

          logger.log(`Created request for CSS import: ${fullUrl}`);
        });

        // Process background images
        resources.backgroundImages.forEach((originalUrl) => {
          const fullUrl = absoluteUrl(originalUrl, context.normalizedUrl);
          if (!fullUrl) return;

          context.addToQueue("request", {
            url: fullUrl,
            redirects: 0,
            id: uuid(),
            addedAt: new Date().toISOString(),
          });

          logger.log(`Created request for background image: ${fullUrl}`);
        });

        // Process fonts
        resources.fonts.forEach((originalUrl) => {
          const fullUrl = absoluteUrl(originalUrl, context.normalizedUrl);
          if (!fullUrl) return;

          context.addToQueue("request", {
            url: fullUrl,
            redirects: 0,
            id: uuid(),
            addedAt: new Date().toISOString(),
          });

          logger.log(`Created request for font: ${fullUrl}`);
        });
      });

    logger.log(`CSS parsing completed`);
  } catch (error) {
    logger.error(`Error processing CSS: ${error.message}`, {
      error: error.message,
      cssLength: cssData?.length,
      parseStage: "css-parsing",
    });
    throw error;
  }
}

// Helper function to find CSS resources
export function findResources() {
  return new Promise((resolve) => {
    const resources = {
      imports: [],
      backgroundImages: [],
      fonts: [],
    };

    const urlRegex = /url\(['"]?([^'"()]+)['"]?\)/g;

    const plugin = () => {
      return {
        postcssPlugin: "postcss-find-resources",
        Once(root) {
          // Process @import rules
          root.walkAtRules("import", (rule) => {
            // Handle different @import formats:
            // 1. @import "file.css";
            // 2. @import url("file.css");
            // 3. @import url(file.css);

            const importValue = rule.params.trim();

            // Check if it's a url() format
            const urlMatch = importValue.match(
              /^url\(['"]?([^'"()]+)['"]?\).*$/,
            );
            if (urlMatch) {
              resources.imports.push(urlMatch[1]);
            } else {
              // It's a direct string format, remove quotes and semicolons
              resources.imports.push(importValue.replace(/['";]/g, ""));
            }
          });

          // Process @font-face rules
          root.walkAtRules("font-face", (rule) => {
            rule.walkDecls("src", (decl) => {
              let match;
              while ((match = urlRegex.exec(decl.value)) !== null) {
                resources.fonts.push(match[1]);
              }
            });
          });

          // Process other URL-containing declarations
          root.walkDecls((decl) => {
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
              let match;
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

export async function parseHtml(context, logger, htmlData) {
  logger.log(`Parsing HTML content`);

  try {
    const $ = cheerio.load(htmlData);

    let baseUrl =
      absoluteUrl($("base")?.attr("href") || "", context.normalizedUrl) ||
      context.normalizedUrl;

    // Process style tags sequentially to properly catch errors
    const styleTags = $("style").toArray();
    for (const el of styleTags) {
      let styleContent = $(el).html();

      // Strip XHTML comment wrappers from style content if present
      styleContent = stripStyleComments(styleContent);

      // Skip empty or invalid style tags
      if (!styleContent) {
        logger.log("Skipping empty style tag");
        continue;
      }

      try {
        // Process the style content
        await parseCss(context, logger, styleContent);
      } catch (styleError) {
        logger.error(`Error parsing inline CSS: ${styleError.message}`, {
          error: styleError.message,
          parseStage: "inline-css-parsing",
        });
        // Continue processing other styles even if one fails
      }
    }

    processElements({
      $,
      cb: (url) => {
        const fullUrl = absoluteUrl(url, baseUrl);
        if (!fullUrl) return;

        context.addToQueue("request", {
          url: fullUrl,
          redirects: 0,
          id: uuid(),
          addedAt: new Date().toISOString(),
        });

        logger.log(`Created request for resource: ${fullUrl}`);
      },
    });

    logger.log(`HTML parsing completed`);
  } catch (error) {
    logger.error(`Error processing HTML: ${error.message}`, {
      error: error.message,
      htmlLength: htmlData?.length,
      parseStage: "html-parsing",
    });
    throw error;
  }
}
