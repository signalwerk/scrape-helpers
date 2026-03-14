export function normalizeUrl({ url, remove = [], logger }) {
  const parsedUrl = new URL(url.toString()); // Ensure we create a new URL object

  if (remove.includes("search")) {
    parsedUrl.search = "";
  } else {
    parsedUrl.search = new URLSearchParams(
      [...new URLSearchParams(parsedUrl.search).entries()].sort((a, b) =>
        a[0].localeCompare(b[0]),
      ),
    ).toString();
  }
  if (remove.includes("hash")) {
    parsedUrl.hash = "";
  }
  return parsedUrl.toString();
}
