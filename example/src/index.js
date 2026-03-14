import { validatePattern } from "../packages/scrape-helpers/src/lib/validatePattern.js";
import { requestLimitMaxRedirects } from "../packages/scrape-helpers/src/lib/requestLimitMaxRedirects.js";
import { requestCheckProcessed } from "../packages/scrape-helpers/src/lib/requestCheckProcessed.js";
import { requestParseURL } from "../packages/scrape-helpers/src/lib/requestParseURL.js";
import { requestNormalizeUrl } from "../packages/scrape-helpers/src/lib/requestNormalizeUrl.js";
import { requestAddToFetch } from "../packages/scrape-helpers/src/lib/requestAddToFetch.js";
import { fetchHttp } from "../packages/scrape-helpers/src/lib/fetchHttp.js";
import { fetchGetMime } from "../packages/scrape-helpers/src/lib/fetchGetMime.js";
import { fetchStoreMimeType } from "../packages/scrape-helpers/src/lib/fetchStoreMimeType.js";
import { fetchAddToParse } from "../packages/scrape-helpers/src/lib/fetchAddToParse.js";
import { fetchLoadData } from "../packages/scrape-helpers/src/lib/fetchLoadData.js";
import { parseProcessHtml } from "../packages/scrape-helpers/src/lib/parseProcessHtml.js";
import { parseProcessCss } from "../packages/scrape-helpers/src/lib/parseProcessCss.js";
import { parseAddToWrite } from "../packages/scrape-helpers/src/lib/parseAddToWrite.js";
import { createRelativeUrlRewriter } from "../packages/scrape-helpers/src/lib/createRelativeUrlRewriter.js";
import { writePrepareContent } from "../packages/scrape-helpers/src/lib/writePrepareContent.js";
import { writeRewriteHtml } from "../packages/scrape-helpers/src/lib/writeRewriteHtml.js";
import { writeRewriteCss } from "../packages/scrape-helpers/src/lib/writeRewriteCss.js";
import { writePatchText } from "../packages/scrape-helpers/src/lib/writePatchText.js";
import { writeFormatWithPrettier } from "../packages/scrape-helpers/src/lib/writeFormatWithPrettier.js";
import { writeFinalizeContent } from "../packages/scrape-helpers/src/lib/writeFinalizeContent.js";
import { writeToFilesystem } from "../packages/scrape-helpers/src/lib/writeToFilesystem.js";
import { QueueDriver } from "../packages/scrape-helpers/src/lib/QueueDriver.js";
import { baseLogger } from "../packages/scrape-helpers/src/lib/SqliteLogger.js";
import { DataPatcher } from "../packages/scrape-helpers/src/lib/DataPatcher.js";
import { completeProcessing } from "../packages/scrape-helpers/src/lib/completeProcessing.js";
import { removeCommentsIf } from "../packages/scrape-helpers/src/lib/removeCommentsIf.js";

// HTML processors for different mime types
const htmlProcessors = {
  "text/html": ($) => {
    removeCommentsIf($, {
      includes: "Saved in parser cache with",
    });
    removeCommentsIf($, {
      includes: "NewPP limit report",
    });
    // This function removes old IE conditional comments from the HTML.
    removeCommentsIf($, {
      includes: ["[if", "endif]"],
    });

    $(".wiki-no-archive").remove(); // hand-curated elements to remove

    $("#footer-icons").remove(); // remove footer mediawiki icon
    $("#footer-places").remove(); // remove «Datenschutz | Über DDOS | Haftungsausschluss»

    $(".mw-editsection").remove(); // remove edit links
    $(".printfooter").remove(); // remove footer in print view

    $('link[rel="edit"]').remove(); // remove edit links

    $('link[type="application/x-wiki"]').remove(); // remove feeds
    $('link[type="application/rsd+xml"]').remove(); // remove feeds
    $('link[type="application/atom+xml"]').remove(); // remove feeds
    $('link[type="application/opensearchdescription+xml"]').remove(); // remove feeds

    $("#n-recentchanges").remove(); // remove «Letzte Änderungen»
    $("#n-randompage").remove(); // remove «Zufällige Seite»
    $("#n-help-mediawiki, #n-help").remove(); // remove «Hilfe zu MediaWiki»  1.39.1, v1.31.0
    $("#p-tb").remove(); // remove «Werkzeuge»

    $("#right-navigation").remove(); // remove «Lesen | Bearbeiten | Versionsgeschichte | Search»
    $("#left-navigation").remove(); // remove «$page | Diskussion»

    $("#mw-head").remove(); // remove «Nicht angemeldet | Diskussionsseite | Beiträge | Benutzerkonto erstellen | Anmelden»

    // remove some js comming from loader/modules
    $('script[src^="/load.php"]').remove();

    // remove links to creat new pages
    $("a.new").each(function () {
      $(this).replaceWith($(this).text());
    });

    // remove «(Diskussion | Beiträge)» form user links (on media/image pages)
    $(".mw-usertoollinks").remove();
  },
  "application/xhtml+xml": ($) => {
    // Use same processing as text/html
    htmlProcessors["text/html"]($);
  },
};

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
    search: /"(wgBackendResponseTime|wgRevisionId|wgCurRevisionId)":[0-9]+/g,
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
    mimeTypes: new Map(), // Map of normalizedUrlWithoutHash to mimeType, used for patching links in HTML/CSS based on the target's mime type
  };
  const rewriteUrl = createRelativeUrlRewriter({
    mimeTypes: processed.mimeTypes,
  });

  return {
    processed,
    deferredQueues: ["write"],

    start: [
      // to parse
      { url: `https://dostag.ch/` },
    ],

    queues: {
      request: [
        requestLimitMaxRedirects(),
        requestParseURL(),
        requestNormalizeUrl(),
        requestCheckProcessed({ processed: processed.request }),
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
          await validatePattern({
            value: context.parsedUrl.href,
            pattern: {
              disallowed: [
                /.*(Diskussion|action=|Spezial|Benutzer.*oldid|Hauptseite.*oldid|title=.*oldid|printable=yes).*/i,
              ],
            },
            logger,
          });
          return context;
        },
        requestAddToFetch(),
      ],

      fetch: [
        fetchHttp(),
        fetchLoadData(),
        fetchGetMime(),
        fetchStoreMimeType({ map: processed.mimeTypes }),
        fetchAddToParse(),
      ],

      parse: [
        parseProcessHtml({ dataPatcher, htmlProcessors }),
        parseProcessCss({ dataPatcher }),
        parseAddToWrite(),
      ],

      write: [
        writePrepareContent(),
        writePatchText({ dataPatcher }),
        writeRewriteHtml({ htmlProcessors, rewriteUrl }),
        writeRewriteCss({ rewriteUrl }),
        writeFormatWithPrettier(),
        writeFinalizeContent(),
        writeToFilesystem({ outputDir: "./DATA/OUTPUT" }),
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
