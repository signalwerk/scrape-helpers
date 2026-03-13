class UrlPatcher {
  constructor() {
    this.rules = [];
  }

  /**
   * Add a patch rule with its own include/exclude patterns
   * @param {Object} config Rule configuration
   * @param {Function} config.transform URL transform function (receives object with URL and optional parameters)
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
    const fullUrl = path.toString(); // Convert URL object to string if needed

    // Check string patterns (exact match)
    if (patterns.strings.some((pattern) => fullUrl === pattern)) {
      return true;
    }
    // Check regex patterns
    if (patterns.regexes.some((pattern) => pattern.test(fullUrl))) {
      return true;
    }
    return false;
  }

  patch(url, data = {}) {
    let [newUrl] = this.transform(url, data);

    return newUrl.toString();
  }

  /**
   * Apply URL transformations
   * @param {string} url URL to transform
   * @param {any} data Data to pass to the transform function
   * @returns {string} Transformed URL
   */
  transform(url, data = {}) {
    if (this.rules.length === 0) {
      return [url, data];
    }

    if (!url) {
      throw new Error("No URL to patch");
    }

    let parsedUrl = new URL(url);
    const originalPath = parsedUrl.pathname;

    const result = this.rules.reduce(
      (current, rule) => {
        // If includes exist, path must match at least one
        if (
          rule.includes.strings.length > 0 ||
          rule.includes.regexes.length > 0
        ) {
          if (!this._matchesPatterns(url, rule.includes)) {
            return current;
          }
        }

        // Skip if path matches any exclude pattern
        if (this._matchesPatterns(url, rule.excludes)) {
          return current;
        }

        // Apply the transform function with object parameter
        let result = rule.transform(current[0], current[1]);

        // if result is not a array make on out of it
        if (!Array.isArray(result)) {
          result = [result, data];
        }

        return result;
      },
      [parsedUrl, data],
    );

    return result;
  }
}

export { UrlPatcher };
