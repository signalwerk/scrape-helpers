// Helper functions
export async function parseURL({ value, logger }) {
  try {
    return new URL(value);
  } catch (error) {
    const message = `Error occurred while parsing the URL: ${error.message} (${value})`;
    logger.error(message);
    throw new Error(message);
  }
}
