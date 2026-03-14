export function fetchLoadData() {
  return async (context, logger) => {
    if (context.cached && context.cachedData) {
      return {
        ...context,
        headers: context.cachedData.metadata?.headers,
        data: context.cachedData.data,
      };
    }

    return {
      ...context,
      headers: context.response?.headers,
      data: context.response?.data,
    };
  };
}
