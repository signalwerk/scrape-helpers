export function isAlreadyRequested({ tracker }) {
  return async ({ job, context }, next) => {
    const url = job.data.uri;

    if (context[tracker].hasBeenRequested(url)) {
      job.log(`URL ${url} has already been requested.`);
      return next(null, true);
    }

    context[tracker].markAsRequested(url);
    next();
  };
}
