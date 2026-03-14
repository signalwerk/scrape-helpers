import prettier from "prettier";

const parsers = {
  "application/xhtml+xml": "html",
  "text/css": "css",
  "text/html": "html",
};

export function writeFormatWithPrettier() {
  return async (context, logger) => {
    const parser = parsers[context.writeMimeType];

    if (
      context.skipWrite ||
      !parser ||
      typeof context.textContent !== "string"
    ) {
      return context;
    }

    let textContent = context.textContent;

    try {
      textContent = await prettier.format(textContent, {
        parser,
      });
      logger.log(
        `Applied prettier formatting (${parser}) for ${context.normalizedUrl}`,
      );
    } catch (prettierError) {
      logger.log(
        `Prettier formatting failed for ${context.normalizedUrl}, writing raw content: ${prettierError.message}`,
      );
    }

    return {
      ...context,
      textContent,
    };
  };
}
