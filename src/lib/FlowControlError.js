// Base class for flow control errors (not real errors, just stops processing)
export class FlowControlError extends Error {
  constructor(message) {
    super(message);
    this.name = "FlowControlError";
    this.isFlowControl = true;
  }
}

// Custom error class for already processed items
export class AlreadyProcessedError extends FlowControlError {
  constructor(message) {
    super(message);
    this.name = "AlreadyProcessedError";
  }
}

// Custom error class for validation failures
export class ValidationError extends FlowControlError {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

// Custom error class for redirect limits
export class RedirectLimitError extends FlowControlError {
  constructor(message) {
    super(message);
    this.name = "RedirectLimitError";
  }
}

// Custom error class for normal redirects
export class RedirectError extends FlowControlError {
  constructor(message) {
    super(message);
    this.name = "RedirectError";
  }
}
