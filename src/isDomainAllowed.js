import path from "path";
import fs from "fs";

export function isDomainAllowed(domain, allowDomains, disallowDomains) {
  if (disallowDomains.includes(domain)) {
    return false;
  }

  if (allowDomains.length === 0 ||
    allowDomains.includes(domain) ||
    isSubdomain(domain, allowDomains)) {
    return true;
  }

  return false;
}
export function ensureDirectoryExistence(filePath) {
  var dirname = path.dirname(filePath);
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
  }
  return true;
}
function isSubdomain(subdomain, domains) {
  for (let i = 0; i < domains.length; i++) {
    const domain = domains[i];
    if (subdomain.endsWith(`.${domain}`) || subdomain === domain) {
      return true;
    }
  }
  return false;
}
export function isMediaURL(url) {
  // Specify the media-type endings
  const mediaTypes = [".pdf", ".jpg", ".jpeg", ".png", ".gif", ".docx", ".doc"];

  // Check if the getNormalizedURL ends with any media-type ending
  for (const mediaType of mediaTypes) {
    if (url.toLowerCase().endsWith(mediaType)) {
      return true;
    }
  }

  return false;
}
