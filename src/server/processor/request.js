export function isPathValid({ job, allowed, disallowed }, next) {
  let path = null;
  try {
    const parsedUrl = new URL(job.data.uri);
    path = parsedUrl.pathname + parsedUrl.search;
  } catch (error) {
    throw new Error("Error occurred while parsing the URL.");
  }

  // Check disallowed path-patterns
  if (
    disallowed?.some((pattern) =>
      pattern instanceof RegExp ? pattern.test(path) : pattern === path,
    )
  ) {
    job.log(`Domain ${path} is disallowed.`);
    return next(null, true);
  }

  // Check allowed path-patterns
  if (
    allowed.length === 0 ||
    allowed.some((pattern) =>
      pattern instanceof RegExp ? pattern.test(path) : pattern === path,
    )
  ) {
    job.log(`Domain ${path} is allowed.`);
    return next();
  }

  job.log(`Domain ${path} is not allowed.`);
  next(null, true);
}

export function isDomainValid({ job, allowed, disallowed }, next) {
  let domain = null;
  try {
    const parsedUrl = new URL(job.data.uri);
    domain = parsedUrl.hostname;
  } catch (error) {
    throw new Error("Error occurred while parsing the URL.");
  }

  // Check disallowed domain-patterns
  if (
    disallowed?.some((pattern) =>
      pattern instanceof RegExp ? pattern.test(domain) : pattern === domain,
    )
  ) {
    job.log(`Domain ${domain} is disallowed.`);
    return next(null, true);
  }

  // Check allowed domain-patterns
  if (
    allowed.length === 0 ||
    allowed.some((pattern) =>
      pattern instanceof RegExp ? pattern.test(domain) : pattern === domain,
    )
  ) {
    job.log(`Domain ${domain} is allowed.`);
    return next();
  }

  job.log(`Domain ${domain} is not allowed.`);
  next(null, true);
}

export function isAlreadyRequested({ job, requestTracker, getKey }, next) {
  const url = job.data.uri;
  const key = getKey(job);

  if (requestTracker.hasBeenRequested(key)) {
    job.log(`URL ${url} has already been requested.`);
    return next(null, true);
  }

  requestTracker.markAsRequested(key);
  next();
}
