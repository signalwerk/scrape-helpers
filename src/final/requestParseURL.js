// Helper functions
export function requestParseURL() {
  return async (context, logger) => {
    const value = context.url;
    try {
      const parsedUrl = new URL(value);
      logger.log(`Parsed URL: ${parsedUrl.href}`);
      return { ...context, parsedUrl };
    } catch (error) {
      const message = `Error occurred while parsing the URL: ${error.message} (${value})`;
      logger.error(message);
      throw new Error(message);
    }
  };
}
