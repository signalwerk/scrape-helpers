export class RequestTracker {
  constructor() {
    this.requested = new Set();
  }

  // don't care about the query params-order or the hash
  makeUnique(url) {
    const newUrl = new URL(url);
    newUrl.search = new URLSearchParams(
      [...new URLSearchParams(newUrl.search).entries()].sort((a, b) =>
        a[0].localeCompare(b[0]),
      ),
    ).toString();
    newUrl.hash = "";
    return newUrl.toString();
  }

  hasBeenRequested(url) {
    return this.requested.has(this.makeUnique(url));
  }

  markAsRequested(url) {
    this.requested.add(this.makeUnique(url));
  }

  clear() {
    this.requested.clear();
  }
}
