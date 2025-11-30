import { v4 as uuid } from "uuid";
import axios from "axios";
import { Cache } from "../../src/lib/Cache.js";
import { validatePattern } from "../../src/lib/validatePattern.js";
import { parseURL } from "../../src/lib/parseURL.js";
import { normalizeUrl } from "../../src/lib/normalizeUrl.js";
import { QueueDriver } from "../../src/lib/QueueDriver.js";
import { checkAndMarkProcessed } from "../../src/lib/checkAndMarkProcessed.js";
import { isCached } from "../../src/lib/isCached.js";
import { guessMimeType } from "../../src/lib/mime.js";
import {
  parseCss,
  parseHtml,
} from "../../src/lib/parse.js";
import { getMimeWithoutEncoding } from "../../src/lib/mime.js";
import {
  SqliteLogger,
  baseLogger,
} from "../../src/lib/SqliteLogger.js";
import {
  RedirectLimitError,
  RedirectError,
} from "../../src/lib/FlowControlError.js";
import { DataPatcher } from "../../src/lib/DataPatcher.js";
import { fsNameOfUri } from "../../src/lib/fsNameOfUri.js";
import { writeFile } from "../../src/lib/writeFile.js";
import { fetchHttp } from "../../src/lib/fetchHttp.js";
import { completeProcessing } from "../../src/lib/completeProcessing.js";
import path from "path";

// Configure data patcher rules
// change content that is different for each request

const dataPatcher = new DataPatcher();

dataPatcher
  .addRule({
    includes: [/.*/],
    search: /"(wgRequestId|cputime|walltime|timestamp)":"[^"]*"/g,
    replace: `"$1":""`,
  })
  .addRule({
    includes: [/.*/],
    search: /"(timingprofile)":\[[^\]]*\]/gm,
    replace: `"$1":[]`,
  })
  .addRule({
    includes: [/.*/],
    search: /"(wgBackendResponseTime)":[0-9]+/g,
    replace: `"$1":0`,
  })
  .addRule({
    includes: [/.*/],
    search: /(mw.loader.implement\("user.tokens@)[^"]+"/g,
    replace: `$10000000"`,
  });

// Create config function to avoid const issues
function createConfig() {
  const processed = {
    request: new Set(),
  };

  return {
    processed,

    start: [
      // to parse
      { url: `https://dostag.ch/` },
    ],

    queues: {
      request: [
        async (context, logger) => {
          if ((context.redirects || 0) > 8) {
            throw new RedirectLimitError(`Max redirects exceeded`);
          }
          return context;
        },
        async (context, logger) => {
          const parsedUrl = await parseURL({ value: context.url, logger });
          logger.log(`Parsed URL: ${parsedUrl.href}`);
          return { ...context, parsedUrl };
        },
        async (context, logger) => {
          const normalizedUrl = normalizeUrl({
            url: context.parsedUrl,
            logger,
          });
          logger.log(`Normalized URL: ${normalizedUrl}`);
          return { ...context, normalizedUrl };
        },
        async (context, logger) => {
          await checkAndMarkProcessed({
            key: context.normalizedUrl,
            processed: processed.request,
            logger,
          });
          return context;
        },
        async (context, logger) => {
          await validatePattern({
            value: context.parsedUrl.hostname,
            pattern: {
              allowed: [/^dostag\.ch$/i],
            },
            logger,
          });
          return context;
        },
        async (context, logger) => {
          context.addToQueue("fetch", context);
          return context;
        },
      ],

      fetch: [
        // check cache
        async (context, logger) => {
          const cacheKey = context.proxy || context.normalizedUrl;
          const { cached, cachedData } = isCached({
            path: "./DATA/SOURCE",
            key: cacheKey,
            logger,
          });

          return {
            ...context,
            cached,
            cachedData,
            cacheKey,
          };
        },

        async (context, logger) => {
          return fetchHttp({
            url: context.normalizedUrl,
            proxy: context.proxy,
            path: "./DATA/SOURCE",
            cacheKey: context.cacheKey,
          })(context, logger);
        },

        async (context, logger) => {
          let headers, data;

          if (context.cached && context.cachedData) {
            // Use cached data
            headers = context.cachedData.metadata?.headers;
            data = context.cachedData.data;
          } else {
            // Use response data
            headers = context.response?.headers;
            data = context.response?.data;
          }

          const mimeType = guessMimeType({
            headers,
            first100Bytes: data?.slice(0, 100),
            logger,
          });

          return {
            ...context,
            mimeType,
          };
        },

        async (context, logger) => {
          context.addToQueue("parse", context);
          return context;
        },
      ],

      parse: [
        // normalize data
        async (context, logger) => {
          if (context.cached && context.cachedData) {
            return {
              ...context,
              headers: context.cachedData.metadata?.headers,
              data: context.cachedData.data,
            };
          } else {
            return {
              ...context,
              headers: context.response?.headers,
              data: context.response?.data,
            };
          }
        },
        async (context, logger) => {
          logger.log(`Starting parse for ${context.normalizedUrl}`);

          const { headers, data } = context;

          // Convert Buffer to string if needed
          const dataString = Buffer.isBuffer(data) ? data.toString() : data;

          const mimeType = getMimeWithoutEncoding(context.mimeType);
          logger.log(`Parsing content with MIME type: ${mimeType}`, {
            mimeType,
          });

          try {
            switch (mimeType) {
              case "application/xhtml+xml":
              case "text/html": {
                const patchedData = dataPatcher.patch(
                  context.parsedUrl.pathname,
                  dataString,
                  logger,
                );

                await parseHtml(context, logger, patchedData);
                break;
              }
              case "text/css": {
                const patchedData = dataPatcher.patch(
                  context.parsedUrl.pathname,
                  dataString,
                  logger,
                );

                await parseCss(context, logger, patchedData);
                break;
              }
              default: {
                logger.log(`No parsing needed for MIME type: ${mimeType}`);
                break;
              }
            }

            return {
              ...context,
              parsed: true,
              parsedAt: new Date().toISOString(),
            };
          } catch (parseError) {
            logger.error(
              `Parse error for ${context.normalizedUrl}: ${parseError.message}`,
              {
                error: parseError.message,
                mimeType,
                parseStage: "content-parsing",
              },
            );

            // Don't throw the error - mark as failed but continue processing
            return {
              ...context,
              parsed: false,
              parseError: parseError.message,
              parsedAt: new Date().toISOString(),
            };
          }
        },
        async (context, logger) => {
          context.addToQueue("write", context);
          return context;
        },
      ],

      write: [
        async (context, logger) => {
          const { headers, data } = context;

          // Convert Buffer to string if needed for text content
          const dataString = Buffer.isBuffer(data) ? data.toString() : data;

          const contentType =
            headers?.["content-type"] || "application/octet-stream";
          const mimeType = getMimeWithoutEncoding(contentType);

          // Apply data patching for text content
          let finalData = data;
          if (
            mimeType === "text/html" ||
            mimeType === "text/css" ||
            mimeType === "application/xhtml+xml"
          ) {
            const patchedData = dataPatcher.patch(
              context.parsedUrl.pathname,
              dataString,
              logger,
            );
            finalData = Buffer.from(patchedData, "utf8");
            logger.log(`Applied data patches for ${context.normalizedUrl}`);
          }

          // Generate filesystem path
          const outputDir = "./DATA/OUTPUT";
          let fsName = fsNameOfUri(context.normalizedUrl, "index.html");

          const filePath = path.resolve(outputDir, fsName);

          // Write to filesystem
          await writeFile(filePath, finalData);

          logger.log(`Wrote file to ${filePath}`, {
            mimeType: contentType,
            size: finalData.length,
          });

          return {
            ...context,
            written: true,
            writtenAt: new Date().toISOString(),
            filePath: filePath,
          };
        },
        completeProcessing(),
      ],
    },
  };
}

// Run the driver
async function main() {
  try {
    const config = createConfig();
    const queueDriver = new QueueDriver(config, {
      maxConcurrent: 3,
    });

    await queueDriver.start();
  } catch (error) {
    baseLogger.error(`Driver failed: ${error.message}`);
    console.error(error);
  }
}

main();
