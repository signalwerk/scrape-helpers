import prettier from "prettier";
import postcss from "postcss";
import { getNewUrl } from "../cleanups/getNewUrl.js";

export async function adjustCSSpaths({
  downloadedFile,
  downloadedFiles,
  content,
}) {
  const { plugin } = await replaceResources((foundUrl) =>
    getNewUrl(foundUrl, downloadedFile.url, downloadedFiles, {
      removeHash: true,
      searchParameters: "remove",
    })
  );
  const formattedCss = await postcss([plugin])
    .process(content)
    .then((result) => {
      // The transformed CSS, where URLs have been replaced.
      console.log("CSS Transformed");
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
function replaceResources(getNewUrl) {
  return new Promise((resolve) => {
    const plugin = postcss.plugin("postcss-replace-resources", () => {
      return (root) => {
        root.walkAtRules("import", (rule) => {
          const match = rule.params.match(/url\(['"]?([^'"]+)['"]?\)/);
          if (match) {
            const oldUrl = match[1];
            const newUrl = getNewUrl(oldUrl);
            rule.params = `url(${newUrl})`;
          }
        });

        root.walkDecls((decl) => {
          const urlRegex = /url\(['"]?([^'"]+)['"]?\)/g;
          let match;

          decl.value = decl.value.replace(urlRegex, (fullMatch, oldUrl) => {
            const newUrl = getNewUrl(oldUrl);
            return `url(${newUrl})`;
          });
        });
      };
    });

    resolve({ plugin });
  });
}
