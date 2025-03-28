import { urlToPath } from "./write.js";

describe("urlToPath", () => {
  test("handles basic URL with html mime type", async () => {
    const job = "https://example.com/page";
    const result = await urlToPath(job, "text/html");
    expect(result).toBe("file://example.com/page.html");
  });

  test("handles umlauts in url", async () => {
    const job = "https://example.com/äöü/äöü.html";
    const result = await urlToPath(job, "text/html");
    expect(result).toBe("file://example.com/äöü/äöü.html");
  });

  test("handles URL ending with slash", async () => {
    const job = "https://example.com/folder/";
    const result = await urlToPath(job, "text/html");
    expect(result).toBe("file://example.com/folder/index.html");
  });

  test("preserves existing extension when mime type matches", async () => {
    const job = "https://example.com/styles.css";
    const result = await urlToPath(job, "text/css");
    expect(result).toBe("file://example.com/styles.css");
  });

  test("handles subdirectories correctly", async () => {
    const job = "https://example.com/blog/posts/article";
    const result = await urlToPath(job, "text/html");
    expect(result).toBe("file://example.com/blog/posts/article.html");
  });

  test("handles query parameters", async () => {
    const job = "https://example.com/search?q=test&page=1";
    const result = await urlToPath(job, "text/html");
    expect(result).toBe("file://example.com/search%3Fpage=1&q=test.html");
  });

  test("handles query parameters with fsExt ending", async () => {
    const job = "https://example.com/search.html?q=test&page=1";
    const result = await urlToPath(job, "text/html");
    expect(result).toBe("file://example.com/search.html%3Fpage=1&q=test.html");
  });

  test("handles equivalent extensions (jpg)", async () => {
    const job = "https://example.com/photo.jpg";
    const result = await urlToPath(job, "image/jpeg");
    expect(result).toBe("file://example.com/photo.jpg");
  });

  test("handles equivalent extensions (jpeg)", async () => {
    const job = "https://example.com/photo.jpeg";
    const result = await urlToPath(job, "image/jpeg");
    expect(result).toBe("file://example.com/photo.jpeg");
  });

  test("handles URLs with extension and not known mime type", async () => {
    const job = "https://example.com/download.pdf";
    const result = await urlToPath(job, "random/mime");
    expect(result).toBe("file://example.com/download.pdf");
  });

  test("handles URLs with different extension than mime type", async () => {
    const job = "https://example.com/file.txt";
    const result = await urlToPath(job, "text/html");
    expect(result).toBe("file://example.com/file.txt.html");
  });

  test("handles very long urls", async () => {
    const job =
      "https://example.com/äöü/this_is_a_very_long_test_filename_designed_to_test_the_write_function_that_requires_handling_of_extremely_long_file_names_and_we_are_including_various_characters_numbers_and_more_just_to_fill_up_the_space_and_see_how_it_handles_extreme_cases_0123456789_abcdefghijklmnopqrstuvwxyz_äöü_&!=_end.html?q=test&page=1";
    const result = await urlToPath(job, "text/html");
    expect(result).toBe(
      "file://example.com/äöü/this_is_a_very_long_test_filename_designed_to_test_the_write_function_that_requires_handling_of_extremely_long_file_names_and_we_are_including_various_characters_numbers_and_more_just_to_fill_up_the_space_and_see_how_it_handles_extreme.html",
    );
  });

  test("adjust http to https", async () => {
    const job = "http://example.com/file.html";
    const result = await urlToPath(job, "text/html");
    expect(result).toBe("file://example.com/file.html");
  });
});
