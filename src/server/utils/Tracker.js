export class Tracker {
  constructor() {
    this.keys = new Set();
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

  hasBeenProcessed(url) {
    return this.keys.has(this.makeUnique(url));
  }

  markAsProcessed(url) {
    this.keys.add(this.makeUnique(url));
  }

  clear() {
    this.keys.clear();
  }
}
