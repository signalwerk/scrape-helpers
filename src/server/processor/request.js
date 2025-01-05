import { isAlreadyProcessed } from "./general.js";

export function isAlreadyRequested() {
  return isAlreadyProcessed({
    tracker: "requestTracker",
  });
}

function validatePattern(
  { job, allowed, disallowed, includes, getValue, type },
  next,
) {
  let value = null;
  try {
    const parsedUrl = new URL(job.data.uri);
    value = getValue(parsedUrl);
  } catch (error) {
    throw new Error(`Error occurred while parsing the URL.`);
  }

  const isMatch = (pattern) =>
    pattern instanceof RegExp ? pattern.test(value) : pattern === value;

  const isIncluded = includes && includes.length > 0 && includes.some(isMatch);

  if (isIncluded) {
    job.log(`${type} ${value} is explicitly included.`);
    return next();
  }

  // Check if explicitly disallowed
  const hasDisallowed = disallowed && disallowed.length > 0;
  const isDisallowed = hasDisallowed && disallowed.some(isMatch);

  if (isDisallowed) {
    job.log(
      `${type} ${value} is explicitly allowed (despite being disallowed).`,
    );
    return next(null, true);
  }

  // Check if explicitly allowed
  const hasAllowed = allowed && allowed.length > 0;
  const isAllowed = hasAllowed && allowed.some(isMatch);

  if (isAllowed) {
    job.log(`${type} ${value} is explicitly allowed.`);
    return next();
  }

  if (hasDisallowed && !isDisallowed && !hasAllowed) {
    job.log(
      `${type} ${value} passed disallowed check and has no allowed check.`,
    );
    return next();
  }

  job.log(`${type} ${value} is not allowed.`);
  next(null, true);
}

export function isPathValid(params) {
  return async ({ job, context }, next) => {
    return await validatePattern(
      {
        ...params,
        job,
        getValue: (url) => url.pathname + url.search,
        type: "Path",
      },
      next,
    );
  };
}

export function isDomainValid(params) {
  return async ({ job, context }, next) => {
    return await validatePattern(
      {
        ...params,
        job,
        getValue: (url) => url.hostname,
        type: "Domain",
      },
      next,
    );
  };
}
