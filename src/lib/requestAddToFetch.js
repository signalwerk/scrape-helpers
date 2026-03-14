export function requestAddToFetch() {
  return async (context, logger) => {
    context.addToQueue("fetch", context);
    return context;
  };
}
