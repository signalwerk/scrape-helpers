// Base class for flow control errors (not real errors, just stops processing)
export class FlowControlError extends Error {
  constructor(message) {
    super(message);
    this.name = "FlowControlError";
    this.isFlowControl = true;
  }
}






