import path from "path";
import { getExtension, sameExtension, fixFilename } from "./fsUtils";

describe("fsUtils", () => {
  describe("getExtension", () => {
    it("should return file extension from filename", () => {
      expect(getExtension("test.jpg")).toBe("jpg");
      expect(getExtension("path/to/file.pdf")).toBe("pdf");
      expect(getExtension("file.with.multiple.dots.txt")).toBe("txt");
    });

    it("should handle empty or undefined input", () => {
      expect(getExtension("")).toBe("");
      expect(getExtension(undefined)).toBe("");
      expect(getExtension(null)).toBe("");
    });
  });

  describe("sameExtension", () => {
    it("should return true for identical extensions", () => {
      expect(sameExtension("jpg", "jpg")).toBe(true);
      expect(sameExtension("pdf", "pdf")).toBe(true);
    });

    it("should handle equivalent extensions", () => {
      expect(sameExtension("jpg", "jpeg")).toBe(true);
      expect(sameExtension("jpeg", "jpg")).toBe(true);
      expect(sameExtension("htm", "html")).toBe(true);
    });

    it("should be case insensitive", () => {
      expect(sameExtension("JPG", "jpg")).toBe(true);
      expect(sameExtension("PDF", "pdf")).toBe(true);
      expect(sameExtension("HTML", "htm")).toBe(true);
    });

    it("should return false for different extensions", () => {
      expect(sameExtension("jpg", "png")).toBe(false);
      expect(sameExtension("pdf", "doc")).toBe(false);
    });

    it("should handle empty or undefined input", () => {
      expect(sameExtension("", "")).toBe(true);
      expect(sameExtension(undefined, undefined)).toBe(true);
      expect(sameExtension("jpg", "")).toBe(false);
      expect(sameExtension("", "jpg")).toBe(false);
    });
  });

  describe("fixFilename", () => {
    it("should preserve file extension", () => {
      const result = fixFilename("/path/to/file.jpg");
      expect(path.extname(result)).toBe(".jpg");
    });

    it("should handle long filenames", () => {
      const longName = "a".repeat(300);
      const result = fixFilename(`/path/to/${longName}.jpg`);

      // Total length should be 240 or less
      expect(path.basename(result).length).toBeLessThanOrEqual(240);

      // Should preserve extension
      expect(path.extname(result)).toBe(".jpg");
    });

    it("should preserve directory structure", () => {
      const result = fixFilename("/path/to/some/file.jpg");
      expect(path.dirname(result)).toBe("/path/to/some");
      expect(result).toBe("/path/to/some/file.jpg");
    });

    it("should handle filenames only", () => {
      const result = fixFilename("/file.jpg");
      expect(result).toBe("/file.jpg");
    });
  });
});
