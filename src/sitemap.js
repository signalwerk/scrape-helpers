import axios from "axios";
import cheerio from "cheerio";

export async function fetchSiteMap(url) {
  // Fetch robots.txt
  const { data: robotsTxt } = await axios.get(url);

  // Extract sitemap url
  const siteMapUrl = robotsTxt
    .split("\n")
    .find((line) => line.includes("Sitemap:"))
    .split(" ")[1];

  // Fetch sitemap
  const { data: siteMapXml } = await axios.get(siteMapUrl);

  // Load the sitemap XML with cheerio
  const $ = cheerio.load(siteMapXml, {
    xmlMode: true,
  });

  // Extract the URLs and last modified dates
  const urlData = $("url")
    .map((i, el) => ({
      url: $(el).find("loc").text(),
      lastmod: new Date($(el).find("lastmod").text()),
    }))
    .get();

  return urlData;
}
