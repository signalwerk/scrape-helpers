function validatePattern({ job, allowed, disallowed, getValue, type }, next) {
  let value = null;
  try {
    const parsedUrl = new URL(job.data.uri);
    value = getValue(parsedUrl);
  } catch (error) {
    throw new Error(`Error occurred while parsing the URL.`);
  }

  // Check disallowed patterns
  if (
    disallowed?.some((pattern) =>
      pattern instanceof RegExp ? pattern.test(value) : pattern === value,
    )
  ) {
    job.log(`${type} ${value} is disallowed.`);
    return next(null, true);
  }

  // Check allowed patterns
  if (
    !allowed ||
    allowed.length === 0 ||
    allowed.some((pattern) =>
      pattern instanceof RegExp ? pattern.test(value) : pattern === value,
    )
  ) {
    job.log(`${type} ${value} is allowed.`);
    return next();
  }

  job.log(`${type} ${value} is not allowed.`);
  next(null, true);
}

export function isPathValid(params, next) {
  return validatePattern(
    {
      ...params,
      getValue: (url) => url.pathname + url.search,
      type: "Path",
    },
    next,
  );
}

export function isDomainValid(params, next) {
  return validatePattern(
    {
      ...params,
      getValue: (url) => url.hostname,
      type: "Domain",
    },
    next,
  );
}


