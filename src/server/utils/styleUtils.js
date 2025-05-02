/**
 * Style-related utility functions
 */

/**
 * Strips XHTML comment wrappers from style content if present
 * Old browsers required styles to be wrapped in comments to hide them
 *
 * @param {string} styleContent - The content of a style tag
 * @returns {string} - The content with XHTML comments stripped
 */
export function stripStyleComments(styleContent) {
  let content = styleContent.trim();
  if (!content) return content;

  // Strip HTML comments wrapper
  if (content.startsWith("<!--") && content.endsWith("-->")) {
    return content.slice(4, -3).trim();
  }

  return content;
}
