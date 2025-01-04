export function isAlreadyProcessed({ tracker }) {
  return async ({ job, context }, next) => {
    const url = job.data.uri;

    if (context[tracker].hasBeenProcessed(url)) {
      job.log(`URL ${url} has already been Processed.`);
      return next(null, true);
    }

    context[tracker].markAsProcessed(url);
    next();
  };
}
