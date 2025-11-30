import { ValidationError } from "./FlowControlError.js";

export { ValidationError } from "./FlowControlError.js";

export async function validatePattern({ value, pattern, logger }) {
  const { allowed, disallowed, includes } = pattern;

  const isMatch = (pattern) =>
    pattern instanceof RegExp ? pattern.test(value) : pattern === value;

  const isIncluded = includes && includes.length > 0 && includes.some(isMatch);

  if (isIncluded) {
    logger.log(`${value} is explicitly included.`);
    return true;
  }

  // Check if explicitly disallowed
  const hasDisallowed = disallowed && disallowed.length > 0;
  const isDisallowed = hasDisallowed && disallowed.some(isMatch);

  if (isDisallowed) {
    logger.log(`${value} is disallowed.`);
    throw new ValidationError(`${value} is disallowed.`);
  }

  // Check if explicitly allowed
  const hasAllowed = allowed && allowed.length > 0;
  const isAllowed = hasAllowed && allowed.some(isMatch);

  if (isAllowed) {
    logger.log(`${value} is explicitly allowed.`);
    return true;
  }

  if (hasDisallowed && !isDisallowed && !hasAllowed) {
    logger.log(`${value} passed disallowed check and has no allowed check.`);
    return true;
  }

  logger.log(`${value} is not allowed.`);
  throw new ValidationError(`${value} is not allowed.`);
}
