export function fetchStoreMimeType({ map }) {
  return async (context, logger) => {
    // Store the resolved mime type so the write phase can look it up
    // when rewriting links (fsReadyNameOfUri needs the target's mime type)
    if (context.normalizedUrl && context.mimeType) {
      map.set(context.normalizedUrl, context.mimeType);
    }
    return context;
  };
}