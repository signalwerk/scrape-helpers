import { FlowControlError } from "./FlowControlError.js";

// Custom error class for already processed items
export class AlreadyProcessedError extends FlowControlError {
  constructor(message) {
    super(message);
    this.name = "AlreadyProcessedError";
  }
}

export function requestCheckProcessed({ processed } = {}) {
  return async (context, logger) => {
    if (!(processed instanceof Set)) {
      throw new Error(
        "requestCheckProcessed requires a Set via the `processed` option",
      );
    }

    const key = context.normalizedUrl;

    if (processed.has(key)) {
      logger.log(`Request for ${key} has already been processed.`);
      throw new AlreadyProcessedError(
        `Request for ${key} has already been processed.`,
      );
    }

    processed.add(key);
    return context;
  };
}
