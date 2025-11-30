export function normalizeUrl({ url, logger }) {
  const parsedUrl = new URL(url.toString()); // Ensure we create a new URL object
  parsedUrl.search = new URLSearchParams(
    [...new URLSearchParams(parsedUrl.search).entries()].sort((a, b) =>
      a[0].localeCompare(b[0]),
    ),
  ).toString();
  parsedUrl.hash = "";
  return parsedUrl.toString();
}
