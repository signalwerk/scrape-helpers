#!/usr/bin/env node

import { fetchSiteMap } from "./packages/scrape-helpers/src/sitemap.js";
import { queue } from "./packages/scrape-helpers/src/queue.js";
import process from "process";
import { fileURLToPath } from "url";
import { dirname } from "path";
import path from "path";
import fs from "fs/promises"; // import file system module for handling file writes

const PROTOCOL = "https";
const DOMAIN = "domain.com";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_FOLDER = path.join(__dirname, "DATA");
const SITEMAP_FILE = path.join(DATA_FOLDER, "sitemap.json"); // specify file path for sitemap

// Get command line arguments
const args = process.argv.slice(2);

async function sitemap() {
  // make the function async to wait for response
  console.log("Scraping sitemap...");
  const response = await fetchSiteMap(`${PROTOCOL}://${DOMAIN}/robots.txt`); // wait for response
  await fs.writeFile(SITEMAP_FILE, JSON.stringify(response, null, 2)); // write response to file as pretty-printed JSON
  console.log(`Sitemap written to ${SITEMAP_FILE}`); // log success message
}

async function runQueue() {
  console.log("Scraping...");

  const HTML_DIR = path.join(DATA_FOLDER, "html"); // specify file path for sitemap
  const DOWNLOAD_FILE = path.join(DATA_FOLDER, "download.json"); // specify file path for sitemap
  const LOGG_FILE = path.join(DATA_FOLDER, "dl.log"); // specify file path for sitemap

  const response = await queue({
    toDownload: [`${PROTOCOL}://${DOMAIN}/`],
    downloadedFile: DOWNLOAD_FILE,
    logFile: LOGG_FILE,
    downloadDir: HTML_DIR,
    allowDomains: [DOMAIN],
    disallowDomains: [],
  }); // wait for response
  // console.log(`Queue written to ${response}`); // log success message
}

// Handle different cases using a switch statement
switch (args[0]) {
  case "--sitemap":
    sitemap();
    break;
  case "--dl":
    runQueue();
    break;
  case "--help":
    console.log("Usage: node cli.js [options]");
    console.log("");
    console.log("Options:");
    console.log("  --sitemap   Perform scraping from sitemap");
    console.log("  --help      Show help");
    break;
  default:
    console.log("Unknown option. Use --help for available options.");
    break;
}
