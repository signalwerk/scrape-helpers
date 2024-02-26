export function fixFilename($, selector, attribute, getUrl) {
  const elements = $(selector);
  elements.each((i, el) => {
    let originalValue = $(el).attr(attribute);

    if (originalValue) {
      if (attribute === "srcset") {
        // Split by comma to get individual URLs in srcset
        const srcsetUrls = originalValue.split(",");
        const fixedUrls = srcsetUrls.map((srcsetUrl) => {
          // Trim and split by space to separate URL and pixel density descriptor
          const [urlTrimmed, descriptor] = srcsetUrl.trim().split(" ");
          const fixedUrl = getUrl(urlTrimmed);
          return descriptor ? `${fixedUrl} ${descriptor}` : fixedUrl;
        });

        const newSrcset = fixedUrls.join(", ");
        // appendToLog(
        //   `START postprocess text/html set ${attribute}: from ${originalValue} to ${newSrcset} (referrer ${downloadedFile.url})`
        // );
        $(el).attr(attribute, newSrcset);
      } else {
        const fixedUrl = getUrl(originalValue);

        if (fixedUrl !== originalValue) {
          $(el).attr(attribute, fixedUrl);
        }
      }
    }
  });
}
