import * as cheerio from "cheerio";
import { absoluteUrl } from "../utils/absoluteUrl.js";
import { getMimeWithoutEncoding } from "../utils/mime.js";
import postcss from "postcss";
import { processElements } from "../utils/processElements.js";

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

    if (!data || !metadata) {
      throw new Error(
        `No data or metadata found in cache ${job.data.cache.key}`,
      );
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

export async function parseCss({ job, events, data }, next) {
  job.log(`parseCss start`);

  const { plugin, resources } = await findResources();

  try {
    // Process the CSS content using PostCSS
    await postcss([plugin])
      .process(data, { from: undefined })
      .then(() => {
        // Process @import rules  
        resources.imports.forEach((originalUrl) => {
          const fullUrl = absoluteUrl(originalUrl, job.data.uri);
          if (!fullUrl) return;

          const requestJobData = {
            ...job.data,
            uri: fullUrl,
            _parent: job.id,
          };

          job.log(`Created request for CSS import: ${fullUrl}`);
          events?.emit("createRequestJob", requestJobData);
        });

        // Process background images
        resources.backgroundImages.forEach((originalUrl) => {
          const fullUrl = absoluteUrl(originalUrl, job.data.uri);
          if (!fullUrl) return;

          const requestJobData = {
            ...job.data,
            uri: fullUrl,
            _parent: job.id,
          };

          job.log(`Created request for background image: ${fullUrl}`);
          events?.emit("createRequestJob", requestJobData);
        });

        // Process fonts
        resources.fonts.forEach((originalUrl) => {
          const fullUrl = absoluteUrl(originalUrl, job.data.uri);
          if (!fullUrl) return;

          const requestJobData = {
            ...job.data,
            uri: fullUrl,
            _parent: job.id,
          };

          job.log(`Created request for font: ${fullUrl}`);
          events?.emit("createRequestJob", requestJobData);
        });
      });

    job.log(`parseCss done`);
    next();
  } catch (error) {
    job.log(`Error processing CSS: ${error.message}`);
    throw error;
  }
}

// Helper function to find CSS resources
function findResources() {
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
            resources.imports.push(rule.params.replace(/['";]/g, ""));
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

export async function parseHtml({ job, events, data }, next) {
  job.log(`parseHtml start`);
  const $ = cheerio.load(data);

  let baseUrl =
    absoluteUrl($("base")?.attr("href") || "", job.data.uri) || job.data.uri;

  processElements({
    $,
    cb: (url) => {
      const fullUrl = absoluteUrl(url, baseUrl);
      if (!fullUrl) return;

      const requestJobData = {
        ...job.data,
        uri: fullUrl,
        _parent: job.id,
      };

      job.log(`Created request for resource: ${fullUrl}`);
      events?.emit("createRequestJob", requestJobData);
    },
  });

  job.log(`parseHtml done`);
  next();
}
