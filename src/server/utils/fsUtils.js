import path from "path";
// Configuration for equivalent extensions
const equivalentExtensions = [
  ["jpg", "jpeg"],
  ["htm", "html"],
  // Add more equivalent pairs here
  // ["ext1", "ext2"],
];

export function getExtension(filename) {
  var ext = path.extname(filename || "").split(".");
  return ext[ext.length - 1];
}
// Utility function to normalize extension based on the configuration
function normalizeExtension(extension) {
  if (!extension) {
    return extension;
  }

  // Convert to lowercase first
  const lowerCaseExt = extension.toLowerCase();

  // Check if this extension has an equivalent
  for (const pair of equivalentExtensions) {
    if (pair.includes(lowerCaseExt)) {
      return pair[0]; // Always return the first item as the 'normalized' version
    }
  }

  return lowerCaseExt; // If no equivalent found, return as is
}
export function sameExtension(fsExt, mimeExt) {
  // Normalize extensions
  const normalizedFsExt = normalizeExtension(fsExt);
  const normalizedMimeExt = normalizeExtension(mimeExt);

  return normalizedFsExt === normalizedMimeExt;
}

export function fixFilename(pathname) {
  if (!pathname) {
    return pathname;
  }
  if (pathname.length < 240) {
    return pathname;
  }

  const dirname = path.dirname(pathname);
  const ext = path.extname(pathname);
  const basename = path.basename(pathname, ext);

  const result = path.join(
    dirname,
    `${basename.slice(0, 240 - ext.length)}${ext}`,
  );

  return result;
}
