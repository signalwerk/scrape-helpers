import path from "path";
import { fsReadyNameOfUri } from "./fsNameOfUri.js";
import { writeFile } from "./writeFile.js";

export function writeToFilesystem({ outputDir = "." } = {}) {
  return async (context, logger) => {
    if (context.skipWrite || !context.outputData) {
      return {
        ...context,
        written: false,
      };
    }

    const fsName = fsReadyNameOfUri({
      uri: context.normalizedUrl,
      mime: context.writeMimeType,
    }).replace(/^http(s)?:\/\//, "");

    const filePath = path.resolve(outputDir, fsName);

    await writeFile(filePath, context.outputData);

    logger.log(`Wrote file to ${filePath}`, {
      mimeType: context.contentType,
      size: context.outputData.length,
      fsName,
    });

    return {
      ...context,
      written: true,
      writtenAt: new Date().toISOString(),
      filePath,
    };
  };
}
