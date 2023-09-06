//importing necessary functions and files from jest
import { test, expect } from "@jest/globals";
import { normalizeURL } from "./normalizeURL.js";

//test cases to test normalizeURL function

test("should normalize relative URL with base path", () => {
  const originalUrl = "/some/path";
  const pageUrl = "https://www.mywebsite.com/a";
  const expectedUrl = "https://www.mywebsite.com/some/path";

  const normalizedUrl = normalizeURL(originalUrl, pageUrl);

  expect(normalizedUrl).toBe(expectedUrl);
});
test("should normalize relative URL with additional path", () => {
  const originalUrl = "./some/path";
  const pageUrl = "https://www.mywebsite.com/a/";
  const expectedUrl = "https://www.mywebsite.com/a/some/path";

  const normalizedUrl = normalizeURL(originalUrl, pageUrl);

  expect(normalizedUrl).toBe(expectedUrl);
});
test("should normalize relative URL with relative path", () => {
  const originalUrl = "../../some/path";
  const pageUrl = "https://www.mywebsite.com/a/b/c/d/";
  const expectedUrl = "https://www.mywebsite.com/a/b/some/path";

  const normalizedUrl = normalizeURL(originalUrl, pageUrl);

  expect(normalizedUrl).toBe(expectedUrl);
});

test("normalizeURL: removes hash if option is set to true", () => {
  const originalUrl = "https://www.example.com/#section1";
  const pageUrl = "https://www.example.com/";
  const options = { removeHash: true };
  const normalizedUrl = normalizeURL(originalUrl, pageUrl, options);
  expect(normalizedUrl).toBe("https://www.example.com/");
});

test("normalizeURL: removes default port for http protocol", () => {
  const originalUrl = "http://www.example.com:80/page1";
  const pageUrl = "https://www.example.com/";
  const options = { enforceHttps: false };
  const normalizedUrl = normalizeURL(originalUrl, pageUrl, options);
  expect(normalizedUrl).toBe("http://www.example.com/page1");
});

test("normalizeURL: removes default port for https protocol", () => {
  const originalUrl = "https://www.example.com:443/page2";
  const pageUrl = "https://www.example.com/";
  const normalizedUrl = normalizeURL(originalUrl, pageUrl);
  expect(normalizedUrl).toBe("https://www.example.com/page2");
});

test("normalizeURL: removes trailing slash if option is set to true and there is no file-ending", () => {
  const originalUrl = "https://www.example.com/resources/";
  const pageUrl = "https://www.example.com/";
  const options = { removeTrailingSlash: true };
  const normalizedUrl = normalizeURL(originalUrl, pageUrl, options);
  expect(normalizedUrl).toBe("https://www.example.com/resources");
});

test("normalizeURL: removes search parameters if option is set to remove", () => {
  const originalUrl = "https://www.example.com/page1?foo=bar&abc=xyz";
  const pageUrl = "https://www.example.com/";
  const options = { searchParameters: "remove" };
  const normalizedUrl = normalizeURL(originalUrl, pageUrl, options);
  expect(normalizedUrl).toBe("https://www.example.com/page1");
});

test("normalizeURL: sorts search parameters if option is set to sort", () => {
  const originalUrl = "https://www.example.com/page2?foo=bar&abc=xyz";
  const pageUrl = "https://www.example.com/";
  const options = { searchParameters: "sort" };
  const normalizedUrl = normalizeURL(originalUrl, pageUrl, options);
  expect(normalizedUrl).toBe("https://www.example.com/page2?abc=xyz&foo=bar");
});

test("normalizeURL: enforces HTTPS if option is set to true", () => {
  const originalUrl = "http://www.example.com/";
  const pageUrl = "https://www.example.com/";
  const options = { enforceHttps: true };
  const normalizedUrl = normalizeURL(originalUrl, pageUrl, options);
  expect(normalizedUrl).toBe("https://www.example.com/");
});

test("normalizeURL: enforces HTTPS if option is set to true", () => {
  const originalUrl =
    "https://ddos.odenwilusenz.ch/load.php?lang=de&modules=filepage%7Cmediawiki.action.view.filepage%7Cmediawiki.interface.helpers.styles%7Cskins.vector.styles.legacy&only=styles&skin=vector";
  const pageUrl = "https://www.example.com/";

  const options = {
    enforceHttps: true,
    removeTrailingSlash: true,
    removeHash: true,
    searchParameters: "keep",
  };

  const normalizedUrl = normalizeURL(originalUrl, pageUrl, options);
  expect(normalizedUrl).toBe("https://www.example.com/");
});
