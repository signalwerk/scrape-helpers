import { FlowControlError } from "./FlowControlError.js";

// Custom error class for redirect limits
class RedirectLimitError extends FlowControlError {
  constructor(message) {
    super(message);
    this.name = "RedirectLimitError";
  }
}

export function requestLimitMaxRedirects({ max = 8 } = {}) {
  return async (context, logger) => {
    if ((context.redirects || 0) > max) {
      throw new RedirectLimitError(`Max redirects exceeded`);
    }
    return context;
  };
}
