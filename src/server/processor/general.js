
export function isAlreadyRequested({ job, tracker, getKey }, next) {
  const url = job.data.uri;
  const key = getKey(job);

  if (tracker.hasBeenRequested(key)) {
    job.log(`URL ${url} has already been requested.`);
    return next(null, true);
  }

  tracker.markAsRequested(key);
  next();
}
