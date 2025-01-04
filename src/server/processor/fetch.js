import axios from "axios";

export function addFetchJob() {
  return async ({ job, context }, next) => {
    try {
      // Add validation logic here for the URI or other request parameters
      if (!job.data.uri) {
        throw new Error("No URI provided");
      }

      // Create a fetch job with the validated data
      const fetchJobData = {
        ...job.data,
        _parent: job.id,
      };

      context.events?.emit("createFetchJob", fetchJobData);
      job.log(`Created fetch job`);

      next();
    } catch (error) {
      throw new Error(`Error: ${error.message}`);
    }
  };
}

export function fetchHttp() {
  return async ({ job, context }, next) => {
    let uri = job.data.uri;
    let isCached = job.data.cache.status === "cached";
    let redirects = job.data.redirects || 0;

    if (isCached) {
      job.log(`skip fetch, file already in cache`);
      return next();
    }

    if (redirects > 8) {
      throw new Error("Too many redirects");
    }

    let response;

    job.data.fetch = {
      type: "http",
    };

    try {
      response = await axios.get(uri, {
        responseType: "arraybuffer",
        maxRedirects: 0, // Prevent automatic redirection
      });
    } catch (axiosError) {
      if (
        axiosError.response &&
        axiosError.response.status >= 300 &&
        axiosError.response.status < 400
      ) {
        // Handle redirect manually
        const newUri = axiosError.response.headers.location;
        // Save metadata to a JSON file
        const metadata = {
          headers: axiosError.response.headers,
          status: axiosError.response.status,
          uri: uri,
          redirected: newUri,
        };

        await context.cache.set(job.data.cache.key, { metadata });
        job.data.cache.status = "cached";
        job.log(`saved metadata to cache`);

        // Create a new job for the redirected URI
        const requestJobData = {
          ...job.data,
          uri: newUri,
          redirects: redirects + 1,
          _parent: job.id,
        };

        context.events?.emit("createRequestJob", requestJobData);
        job.log(`Created request job – Redirected to new URI: ${newUri}`);

        return next(null, true);
      }
      // Add error logging
      job.error = axiosError.response?.status;

      // Save error to cache
      const metadata = {
        headers: axiosError.response.headers,
        status: axiosError.response.status,
        uri: uri,
        error: axiosError.response?.status,
      };
      await context.cache.set(job.data.cache.key, { metadata });

      job.data.cache.status = "cached";
      job.log(`saved error to cache`);

      throw new Error(
        `Request failed. Status: ${
          axiosError.response?.status || "unknown"
        } Text: ${axiosError.response?.statusText || "unknown"} Message: ${
          axiosError.message || "unknown"
        }`,
      );
    }

    // Save to cache
    const metadata = {
      headers: response.headers,
      status: response.status,
      uri: uri,
    };

    await context.cache.set(job.data.cache.key, {
      metadata,
      data: response.data,
    });
    job.data.cache.status = "cached";
    job.log(`saved data and metadata to cache`);

    next();
  };
}

export function isCached() {
  return async ({ job, context }, next) => {
    const key = job.data.uri;

    if (context.cache.has(key)) {
      job.log(`File already in cache`);

      const metadata = context.cache.getMetadata(key);
      if (metadata.redirected) {
        job.log(`Cache has redirect, follow redirecting`);
        const newUri = metadata.redirected;

        // Create a new job for the redirected URI
        const requestJobData = {
          ...job.data,
          uri: newUri,
          _parent: job.id,
        };

        context.events?.emit("createRequestJob", requestJobData);
        job.log(`Created request job – Redirected to new URI: ${newUri}`);

        return next(null, true);
      } else if (metadata.error) {
        job.error = metadata.error;
        throw new Error(
          `Job is cached but has error: ${job.error} no need proceed`,
        );
      } else {
        job.data.cache = {
          status: "cached",
          key,
        };
      }
    } else {
      job.log(`File not in cache`);
      job.data.cache = {
        status: "not-cached",
        key,
      };
    }
    return next();
  };
}
