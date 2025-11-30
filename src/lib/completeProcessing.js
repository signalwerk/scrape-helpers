export function completeProcessing() {
  return async (context, logger) => {
    context.complete();
    logger.log(`Processing completed for ${context.normalizedUrl}`);
    return context;
  };
}
