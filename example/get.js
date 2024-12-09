#!/usr/bin/env node

import { queue } from "./packages/scrape-helpers/src/queue.js";
import process from "process";
import { fileURLToPath } from "url";
import { dirname } from "path";
import path from "path";
import prettier from "prettier";
import * as cheerio from "cheerio";
import fs from "fs";
import { adjustCSSpaths } from "./packages/scrape-helpers/src/css/adjustCSSpaths.js";
import { fixFilename } from "./packages/scrape-helpers/src/cleanups/fixFilename.js";
import { getNewUrl } from "./packages/scrape-helpers/src/cleanups/getNewUrl.js";

const PROTOCOL = "https";
const DOMAIN = "domain.com";
const allowDomains = ["unpkg.com"];

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_FOLDER = path.join(__dirname, "DATA");

// Get command line arguments
const args = process.argv.slice(2);

async function runQueue() {
  console.log("Scraping...");

  const HTML_DIR = path.join(DATA_FOLDER, "html");
  const DOWNLOAD_FILE = path.join(DATA_FOLDER, "download.json");
  const LOG_FILE = path.join(DATA_FOLDER, "dl.log");

  const response = await queue({
    toDownload: [`${PROTOCOL}://${DOMAIN}/`],
    typesToDownload: ["html", "image", "stylesheet", "script", "icon"],
    downloadedFile: DOWNLOAD_FILE,
    logFile: LOG_FILE,
    downloadDir: HTML_DIR,
    allowDomains: [DOMAIN, ...allowDomains],
    disallowDomains: [],
    normalizeOptions,
    // rejectRegex: ".*",
    // includeRegex: ".*",
    // process: {
    //   // process all files before post-processing
    //   ["text/html"]: async ({ url, path }, appendCb) => {
    //     let newContent = fs.readFileSync(path, "utf8");

    //     const replacements = [
    //       {
    //         search: `xxx`,
    //         replace: `yyy`,
    //       },
    //     ];

    //     for (const replacement of replacements) {
    //       newContent = newContent.replaceAll(
    //         replacement.search,
    //         replacement.replace,
    //       );
    //     }

    //     fs.writeFileSync(path, newContent);
    //   },
    // },
    postProcess: {
      ["text/css"]: async ({
        downloadedFile,
        downloadedFiles,
        appendToLog,
      }) => {
        const content = fs.readFileSync(downloadedFile.path, "utf8");
        try {
          const formattedCss = await adjustCSSpaths({
            downloadedFile,
            downloadedFiles,
            content,
            appendToLog,
          });
          fs.writeFileSync(downloadedFile.path, formattedCss);
        } catch (e) {
          console.log(`Error in adjust CSS ${downloadedFile.path}`);
          console.log(e);
        }
      },
      ["text/html"]: async ({
        downloadedFile,
        downloadedFiles,
        appendToLog,
      }) => {
        try {
          const content = fs.readFileSync(downloadedFile.path, "utf8");
          const $ = cheerio.load(content);

          const fix = (url) =>
            getNewUrl({
              url,
              refferer: downloadedFile.url,
              downloadedFiles: downloadedFiles,
              appendToLog,
            });

          const fixButKeepHash = (url) => {
            let hash = "";
            if (url.includes("#")) {
              const parts = url.split("#");
              url = parts[0];
              hash = "#" + parts[1];
            }
            return fix(url) + hash;
          };

          fixFilename($, "a", "href", fixButKeepHash);
          fixFilename($, "img", "src", fix);
          fixFilename($, "img", "srcset", fix);
          fixFilename($, "source", "srcset", fix);
          fixFilename($, "script", "src", fix);
          fixFilename($, "link[rel=stylesheet]", "href", fix);
          fixFilename($, "link[rel=icon]", "href", fix);
          fixFilename($, "link[rel=canonical]", "href", fix);
          fixFilename($, "link[rel=alternate]", "href", fix);

          let finalHtml = $.html();

          try {
            finalHtml = await prettier.format(finalHtml, {
              parser: "html",
            });
          } catch (e) {
            console.log(`Error in prettier HTML ${downloadedFile.path}`);
            console.log(e);
          }

          fs.writeFileSync(downloadedFile.path, finalHtml);
        } catch (e) {
          console.log(`Error in adjust HTML ${downloadedFile.path}`);
          console.log(e);
        }
      },
    },
  }); // wait for response
}

// Handle different cases using a switch statement
switch (args[0]) {
  case "--clear":
    console.log("Clearing...");
    fs.rmSync(DATA_FOLDER, { recursive: true, force: true });
    break;
  case "--dl":
    runQueue();
    break;
  case "--help":
    console.log("Usage: node cli.js [options]");
    console.log("");
    console.log("Options:");
    console.log("  --clear     Delete the data folder");
    console.log("  --dl        Download all files from domain");
    console.log("  --help      Show help");
    break;
  default:
    console.log("Unknown option. Use --help for available options.");
    break;
}
