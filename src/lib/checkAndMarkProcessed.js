import { AlreadyProcessedError } from "./FlowControlError.js";

export { AlreadyProcessedError } from "./FlowControlError.js";

export async function checkAndMarkProcessed({ key, processed, logger }) {
  if (processed.has(key)) {
    logger.log(`Request for ${key} has already been processed.`);
    throw new AlreadyProcessedError(
      `Request for ${key} has already been processed.`,
    );
  } else {
    processed.add(key);
    return true;
  }
}
