// This function removes old IE conditional comments from the HTML.

export function removeIEComments(html) {
    let cleanStr = html;
    cleanStr = cleanStr.replace(/<!--\[if[\s\S]*?-->/g, "");
    cleanStr = cleanStr.replace(/<!--([^>]+?)endif\]-->/g, "");

    return cleanStr;
}
