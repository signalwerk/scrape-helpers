import prettier from "prettier";
import postcss from "postcss";
import { getNewUrl } from "../cleanups/getNewUrl.js";

export async function adjustCSSpaths({
  downloadedFile,
  downloadedFiles,
  content,
  appendToLog,
}) {
  const { plugin } = await replaceResources((foundUrl) =>
    getNewUrl({
      url: foundUrl,
      refferer: downloadedFile.url,
      downloadedFiles,

      normalizeOptions: {
        removeHash: true,
        searchParameters: "remove",
      },
      appendToLog,
    })
  );
  const formattedCss = await postcss([plugin])
    .process(content)
    .then((result) => {
      // The transformed CSS, where URLs have been replaced.
      return prettier.format(result.css, {
        parser: "css",
      });
    })
    .catch((err) => {
      console.error("Error processing the CSS:", err);
      return;
    });
  return formattedCss;
}
function replaceResources(cb) {
  return new Promise((resolve) => {
    const plugin = postcss.plugin("postcss-replace-resources", () => {
      return (root) => {
        root.walkAtRules("import", (rule) => {
          const match = rule.params.match(/url\(['"]?([^'"]+)['"]?\)/);
          if (match) {
            const oldUrl = match[1];
            const newUrl = cb(oldUrl);
            rule.params = `url(${newUrl})`;
          }
        });

        root.walkDecls((decl) => {
          const urlRegex = /url\(['"]?([^'"]+)['"]?\)/g;
          let match;

          decl.value = decl.value.replace(urlRegex, (fullMatch, oldUrl) => {
            const newUrl = cb(oldUrl);
            return `url(${newUrl})`;
          });
        });
      };
    });

    resolve({ plugin });
  });
}
