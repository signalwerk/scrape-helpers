export function fetchAddToParse({ queueName = "parse" } = {}) {
  return async (context, logger) => {
    context.addToQueue(queueName, context);
    return context;
  };
}
