import postcss from "postcss";

const urlRegex = /url\(['"]?(?!data:)([^'"]+)['"]?\)/g;

function replaceResources(cb) {
  return new Promise((resolve) => {
    const plugin = () => {
      return {
        postcssPlugin: "postcss-replace-resources",
        Once(root) {
          root.walkAtRules("import", (rule) => {
            const match = rule.params.match(urlRegex);
            if (match) {
              const oldUrl = match[1];
              const newUrl = cb(oldUrl);
              rule.params = `url(${newUrl})`;
            }
          });

          root.walkDecls((decl) => {
            let match;

            decl.value = decl.value.replace(urlRegex, (fullMatch, oldUrl) => {
              const newUrl = cb(oldUrl);
              return `url(${newUrl})`;
            });
          });
        },
      };
    };

    plugin.postcss = true;

    resolve({ plugin });
  });
}

export async function rewriteCss({ content, cb, logger }) {
  const { plugin } = await replaceResources(
    //
    (url) => cb(url) || url,
  );
  const formattedCss = await postcss([plugin])
    .process(content, {
      // Explicitly set the `from` option to `undefined` to prevent
      // sourcemap warnings which aren't relevant to this use case.
      from: undefined,
    })
    .then((result) => {
      // The transformed CSS, where URLs have been replaced.
      return result.css;
    })
    .catch((err) => {
      throw new Error(`Error processing the CSS: ${err}`);
    });
  return formattedCss;
}
