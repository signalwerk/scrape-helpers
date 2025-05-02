import fs from "fs";
import path from "path";
import postcss from "postcss";
import prettier from "prettier";
import * as cheerio from "cheerio";
import { absoluteUrl } from "../utils/absoluteUrl.js";
import { getRelativeURL } from "../utils/getRelativeURL.js";
import { getExtensionOfMime } from "../utils/mime.js";
import { UrlPatcher } from "../utils/UrlPatcher.js";
import { writeFile } from "../utils/writeFile.js";
import { getExtension, sameExtension, fixFilename } from "../utils/fsUtils.js";
import { processElements } from "../utils/processElements.js";
import { isAlreadyProcessed } from "./general.js";
import { stripStyleComments } from "../utils/styleUtils.js";

export function isAlreadyWritten() {
  return isAlreadyProcessed({
    tracker: "writeTracker",
  });
}

export async function writeData({ job, data, metadata }, next) {
  const baseDir = "./DATA/OUT";

  const fsNameOfUri = urlToPath(job.data.uri, metadata.headers["content-type"])
    .replace("file://", "/")
    .replace("%3F", "?");
  const filePath = path.join(baseDir, fsNameOfUri);

  await writeFile(filePath, data);
  job.log(`Wrote data to ${filePath}`);
  next();
}

export function writeOutput({ rewrite, getUrl }) {
  return async ({ job, context }, next) => {
    const { data: dataOrignal, metadata } = context.cache.get(
      job.data.cache.key,
    );

    let data = dataOrignal;

    const mime = job.data.mimeType;

    if (mime === "text/html") {
      data = context.dataPatcher.patch(job.data.uri, `${data}`, (log) =>
        job.log(log),
      );

      const $ = cheerio.load(data);
      if (rewrite && rewrite[mime]) {
        rewrite[mime]($);
      }

      // Process inline style tags sequentially to rewrite URLs and apply proper formatting
      const styleTags = $("style").toArray();
      for (const element of styleTags) {
        let styleContent = $(element).html();

        // Strip XHTML comment wrappers from style content if present
        styleContent = stripStyleComments(styleContent);

        if (!styleContent) {
          $(element).remove();
          continue;
        }

        const rewrittenCss = await rewriteCss({
          content: styleContent,
          job,
          mime,
          cache: context.cache,
          getUrl,
          createWriteJob: (writeJobData) =>
            context.events?.emit("createWriteJob", writeJobData),
        });
        if (rewrittenCss) {
          $(element).html(rewrittenCss);
        } else {
          $(element).remove();
        }
      }

      await rewriteHtml(
        {
          job,
          mime,
          cache: context.cache,
          getUrl,
          createWriteJob: (writeJobData) =>
            context.events?.emit("createWriteJob", writeJobData),
          $,
        },
        next,
      );

      data = $.html();

      try {
        data = await prettier.format(data, { parser: "html" });
      } catch (error) {
        throw new Error(`Error formatting HTML: ${error}`);
      }
    }

    if (mime === "text/css") {
      data = context.dataPatcher.patch(job.data.uri, `${data}`, (log) =>
        job.log(log),
      );

      data = await rewriteCss({
        content: data,
        job,
        mime,
        cache: context.cache,
        getUrl,
        createWriteJob: (writeJobData) =>
          context.events?.emit("createWriteJob", writeJobData),
      });

      try {
        data = await prettier.format(`${data}`, { parser: "css" });
      } catch (error) {
        throw new Error(`Error formatting CSS: ${error}`);
      }
    }

    await writeData(
      {
        job,
        data,
        metadata,
      },
      next,
    );
  };
}

export function handleRedirected() {
  return async ({ job, context }, next) => {
    const key = job.data.uri;

    if (context.cache.has(key)) {
      job.log(`File already in cache`);

      const metadata = context.cache.getMetadata(key);
      if (metadata.redirected) {
        job.log(`Cache has redirect, follow redirecting`);
        const newUri = metadata.redirected;

        // Create a new job for the redirected URI
        const writeJobData = {
          ...job.data,
          uri: newUri,
          _parent: job.id,
        };

        context.events?.emit("createWriteJob", writeJobData);
        job.log(`Created write job – Redirected to new URI: ${newUri}`);

        return next(null, true);
      } else if (metadata.error) {
        job.error = metadata.error;
        throw new Error(
          `Job is cached but has error: ${job.error} no need proceed`,
        );
      } else {
        job.data.cache = {
          status: "cached",
          key,
        };
      }
    } else {
      job.data.cache = {
        status: "not-cached",
        key,
      };
      // throw new Error(`File not in cache`);
      job.log(`File not in cache`);
      return next(null, true);
    }
    return next();
  };
}

const patcher = new UrlPatcher();
patcher
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

export function urlToPath(uri, mime) {
  const mimeExt = getExtensionOfMime(mime);
  let url = patcher.patch(uri, { mimeExt });

  let result = decodeURIComponent(url);

  return result;
}

function extractProtocolPortDomain(url) {
  try {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol;
    const port = urlObj.port ? `:${urlObj.port}` : "";
    const domain = urlObj.hostname;
    return `${protocol}//${domain}${port}`;
  } catch (error) {
    console.error("Invalid URL:", error);
    return null;
  }
}

export async function rewriteHtml(
  { job, mime, cache, createWriteJob, getUrl, $ },
  next,
) {
  job.log(`rewriteHtml start`);

  let baseUrl =
    absoluteUrl($("base")?.attr("href") || "", job.data.uri) || job.data.uri;

  let fileBaseUrl = urlToPath(baseUrl, mime);

  processElements({
    $,
    cb: (url) => {
      const fullUrl = absoluteUrl(url, baseUrl);
      if (!fullUrl) return;

      // If the URL is the same as the base URL, we rewrite it to the root URL
      // this is for example used in link[rel=alternate] or link[rel=canonical]
      if (fullUrl === baseUrl) {
        return getRelativeURL(
          fullUrl,
          extractProtocolPortDomain(baseUrl),
          true,
          true,
        );
      }

      const writeJobData = {
        ...job.data,
        uri: fullUrl,
        _parent: job.id,
      };

      if (createWriteJob) {
        createWriteJob(writeJobData);
        job.log(`Created write job for resource: ${fullUrl}`);
      } else {
        throw new Error("No createWriteJob function provided");
      }

      if (cache.has(fullUrl)) {
        const metadata = cache.getMetadata(fullUrl);

        let fileAbsoluteUrl = urlToPath(
          fullUrl,
          metadata.headers["content-type"],
        );

        const patchedUrl = getUrl
          ? getUrl({ absoluteUrl: fileAbsoluteUrl, baseUrl: fileBaseUrl })
          : getRelativeURL(fileAbsoluteUrl, fileBaseUrl, false, false);

        job.log(`rewrite ${fullUrl} to ${patchedUrl}`);

        return patchedUrl;
      }
    },
  });

  job.log(`parseHtml done`);
  next();
}

export async function rewriteCss(
  { content, job, mime, cache, createWriteJob, getUrl },
  next,
) {
  job.log(`rewriteCss start`);

  let baseUrl = job.data.uri;

  let fileBaseUrl = urlToPath(baseUrl, mime);

  const { plugin } = await replaceResources(
    //
    (url) => {
      const fullUrl = absoluteUrl(url, baseUrl);
      if (!fullUrl) return;

      const writeJobData = {
        ...job.data,
        uri: fullUrl,
        _parent: job.id,
      };

      if (createWriteJob) {
        createWriteJob(writeJobData);
        job.log(`Created write job for resource: ${fullUrl}`);
      } else {
        throw new Error("No createWriteJob function provided");
      }

      if (cache.has(fullUrl)) {
        // urlToPath(uri, mime)
        const metadata = cache.getMetadata(fullUrl);

        let fileAbsoluteUrl = urlToPath(
          fullUrl,
          metadata.headers["content-type"],
        );

        const patchedUrl = getUrl
          ? getUrl({ absoluteUrl: fileAbsoluteUrl, baseUrl: fileBaseUrl })
          : getRelativeURL(fileAbsoluteUrl, fileBaseUrl, false, false);

        job.log(`rewrite ${fullUrl} to ${patchedUrl}`);

        return patchedUrl;
      }
    },
  );
  const formattedCss = await postcss([plugin])
    .process(content, {
      // Explicitly set the `from` option to `undefined` to prevent
      // sourcemap warnings which aren't relevant to this use case.
      from: undefined,
    })
    .then((result) => {
      // The transformed CSS, where URLs have been replaced.
      return result.css;
    })
    .catch((err) => {
      throw new Error(`Error processing the CSS: ${err}`);
    });
  return formattedCss;
}

const urlRegex = /url\(['"]?(?!data:)([^'"]+)['"]?\)/g;

function replaceResources(cb) {
  return new Promise((resolve) => {
    const plugin = () => {
      return {
        postcssPlugin: "postcss-replace-resources",
        Once(root) {
          root.walkAtRules("import", (rule) => {
            const match = rule.params.match(urlRegex);
            if (match) {
              const oldUrl = match[1];
              const newUrl = cb(oldUrl);
              rule.params = `url(${newUrl})`;
            }
          });

          root.walkDecls((decl) => {
            let match;

            decl.value = decl.value.replace(urlRegex, (fullMatch, oldUrl) => {
              const newUrl = cb(oldUrl);
              return `url(${newUrl})`;
            });
          });
        },
      };
    };

    plugin.postcss = true;

    resolve({ plugin });
  });
}
