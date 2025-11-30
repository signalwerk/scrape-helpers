import { stripStyleComments } from "./styleUtils.js";
import { jest } from "@jest/globals";

describe("stripStyleComments", () => {
  test("should not modify normal CSS content", () => {
    const normalCSS = `
      body {
        font-family: sans-serif;
        color: #333;
      }
      
      .header {
        background-color: #f5f5f5;
      }
    `;

    expect(stripStyleComments(normalCSS)).toBe(normalCSS.trim());
  });

  test("should strip HTML comment wrappers from CSS content", () => {
    const commentWrappedCSS = `<!--
      body {
        font-family: sans-serif;
        color: #333;
      }
      
      .header {
        background-color: #f5f5f5;
      }
    -->`;

    const expectedResult = `
      body {
        font-family: sans-serif;
        color: #333;
      }
      
      .header {
        background-color: #f5f5f5;
      }
    `.trim();

    expect(stripStyleComments(commentWrappedCSS)).toBe(expectedResult);
  });

  test("should handle empty content", () => {
    expect(stripStyleComments("")).toBe("");
    expect(stripStyleComments("   ")).toBe("");
  });

  test("should handle content with only HTML comments", () => {
    expect(stripStyleComments("<!-- -->")).toBe("");
  });

  test("should handle content with nested comments correctly", () => {
    const nestedComments = `<!--
      /* This is a CSS comment */
      body {
        color: red;
      }
    -->`;

    const expected = `
      /* This is a CSS comment */
      body {
        color: red;
      }
    `.trim();

    expect(stripStyleComments(nestedComments)).toBe(expected);
  });

  test("should handle content with multiple HTML comments", () => {
    // This test verifies that with nested comments, we extract content without the outermost wrapper
    const multipleComments = `<!-- outer start
      <!-- inner comment -->
      body { color: red; }
    outer end -->`;

    // The function keeps the content between <!-- and --> markers
    const expected = `outer start
      <!-- inner comment -->
      body { color: red; }
    outer end`.trim();

    expect(stripStyleComments(multipleComments)).toBe(expected);
  });

  test("should handle malformed HTML comments", () => {
    const malformedComment = `<!--
      body { color: red; }
    -> some text`;

    // Malformed comments should be returned as is (trimmed)
    expect(stripStyleComments(malformedComment)).toBe(malformedComment.trim());
  });

  test("should handle content with leading/trailing whitespace", () => {
    const contentWithWhitespace = `  
    <!--
      body { color: red; }
    -->  
    `;

    const expected = `body { color: red; }`.trim();

    expect(stripStyleComments(contentWithWhitespace)).toBe(expected);
  });
});
