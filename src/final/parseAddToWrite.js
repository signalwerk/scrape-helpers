export function parseAddToWrite({ queueName = "write" } = {}) {
  return async (context, logger) => {
    context.addToQueue(queueName, context);
    return context;
  };
}
