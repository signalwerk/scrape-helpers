export class DataPatcher {
  constructor() {
    this.rules = [];
  }

  /**
   * Add a patch rule with its own include/exclude patterns
   * @param {Object} config Rule configuration
   * @param {string|RegExp} config.search Search pattern
   * @param {string} config.replace Replacement string
   * @param {Array<string|RegExp>} [config.includes] Include patterns
   * @param {Array<string|RegExp>} [config.excludes] Exclude patterns
   */
  addRule({ search, replace, includes = [], excludes = [] }) {
    this.rules.push({
      search,
      replace,
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
    // Handle case when patterns is not an array
    if (!Array.isArray(patterns)) {
      patterns = [patterns];
    }

    return patterns.reduce(
      (acc, p) => {
        if (typeof p === "string") {
          acc.strings.push(p);
        } else if (p instanceof RegExp) {
          acc.regexes.push(p);
        }
        return acc;
      },
      { strings: [], regexes: [] }
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
   * Apply patches to data
   * @param {string} path
   * @param {string} data
   * @param {Object} [logger] Logger instance for logging patch operations
   * @returns {string}
   */
  patch(path, data, logger = null) {
    if (this.rules.length === 0) {
      return data;
    }

    if (!data) {
      if (logger) {
        logger.log("No data to patch");
      }
      return data;
    }

    return this.rules.reduce((patchedData, rule) => {
      // If includes exist, path must match at least one
      if (rule.includes.strings.length > 0 ||
        rule.includes.regexes.length > 0) {
        if (!this._matchesPatterns(path, rule.includes)) {
          return patchedData;
        }
      }

      // Skip if path matches any exclude pattern
      if (this._matchesPatterns(path, rule.excludes)) {
        return patchedData;
      }

      // Apply the patch and log it
      const originalLength = patchedData.length;
      const result = patchedData.replace(rule.search, rule.replace);

      if (result !== patchedData && logger) {
        logger.log(`Applied patch to ${path}: replaced "${rule.search}" with "${rule.replace}"`);
      }

      return result;
    }, data);
  }
}
