class UrlPatcher {
  constructor() {
    this.rules = [];
  }

  /**
   * Add a patch rule with its own include/exclude patterns
   * @param {Object} config Rule configuration
   * @param {Function} config.transform URL transform function (receives URL object, returns URL object)
   * @param {Array<string|RegExp>} [config.includes] Include patterns
   * @param {Array<string|RegExp>} [config.excludes] Exclude patterns
   */
  addRule({ transform, includes = [], excludes = [] }) {
    this.rules.push({
      transform,
      includes: this._categorizePatterns(includes),
      excludes: this._categorizePatterns(excludes),
    });
    return this;
  }

  /**
   * Categorize patterns into strings and regexes
   * @private
   */
  _categorizePatterns(patterns) {
    return patterns.reduce(
      (acc, p) => {
        if (typeof p === "string") {
          acc.strings.push(p);
        } else if (p instanceof RegExp) {
          acc.regexes.push(p);
        }
        return acc;
      },
      { strings: [], regexes: [] },
    );
  }

  /**
   * Check if path matches patterns
   * @private
   */
  _matchesPatterns(path, patterns) {
    // Check string patterns (exact match)
    if (patterns.strings.some((pattern) => path === pattern)) {
      return true;
    }
    // Check regex patterns
    if (patterns.regexes.some((pattern) => pattern.test(path))) {
      return true;
    }
    return false;
  }

  /**
   * Apply URL transformations
   * @param {string} url URL to transform
   * @param {string} [mime] Optional MIME type
   * @returns {string} Transformed URL
   */
  patch(url, mime) {
    if (this.rules.length === 0) {
      return url;
    }

    if (!url) {
      throw new Error("No URL to patch");
    }

    let parsedUrl = new URL(url);
    const originalPath = parsedUrl.pathname;

    return this.rules.reduce((currentUrl, rule) => {
      // If includes exist, path must match at least one
      if (
        rule.includes.strings.length > 0 ||
        rule.includes.regexes.length > 0
      ) {
        if (!this._matchesPatterns(originalPath, rule.includes)) {
          return currentUrl;
        }
      }

      // Skip if path matches any exclude pattern
      if (this._matchesPatterns(originalPath, rule.excludes)) {
        return currentUrl;
      }

      // Apply the transform function
      const transformedUrl = rule.transform(new URL(currentUrl), mime);
      return transformedUrl.toString();
    }, url);
  }
}

export { UrlPatcher };
