import { Cache } from "./Cache.js";

// Processor functions
export function isCached({ path, key, logger }) {
  if (!path || !key) {
    throw new Error("Path and key are required");
  }

  const cache = new Cache(path);

  if (cache.has(key)) {
    logger.log(`Cache hit for ${key}`);
    const cached = cache.get(key);
    return { cached: true, cachedData: cached };
  } else {
    logger.log(`Cache miss for ${key}`);
    return { cached: false };
  }
}
