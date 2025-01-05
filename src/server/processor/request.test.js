import { jest } from "@jest/globals";

import { isPathValid, isDomainValid } from "./request";

describe("Request Validation", () => {
  // Common test setup
  const mockJob = {
    data: { uri: "https://example.com/path?query=1" },
    log: jest.fn(),
  };
  const mockNext = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("isPathValid", () => {
    it("should allow paths that match allowed patterns", async () => {
      const params = {
        allowed: [/^\/path/, "/path?query=1"],
      };

      const middleware = isPathValid(params);
      await middleware({ job: mockJob }, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should reject paths that match disallowed patterns", async () => {
      const params = {
        allowed: [/^\/path/],
        disallowed: [/query=1$/],
      };

      const middleware = isPathValid(params);
      await middleware({ job: mockJob }, mockNext);

      expect(mockNext).toHaveBeenCalledWith(null, true);
    });

    it("should throw error for invalid URLs", async () => {
      const params = {
        allowed: [],
      };
      const invalidJob = { data: { uri: "invalid-url" } };

      const middleware = isPathValid(params);
      await expect(middleware({ job: invalidJob }, mockNext)).rejects.toThrow(
        "Error occurred while parsing the URL.",
      );
    });
  });

  describe("isDomainValid", () => {
    it("should allow domains that match allowed patterns", async () => {
      const params = {
        allowed: ["example.com", /\.com$/],
      };

      const middleware = isDomainValid(params);
      await middleware({ job: mockJob }, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should reject domains that match disallowed patterns", async () => {
      const params = {
        allowed: [/.*/],
        disallowed: ["example.com"],
      };

      const middleware = isDomainValid(params);
      await middleware({ job: mockJob }, mockNext);

      expect(mockNext).toHaveBeenCalledWith(null, true);
    });
  });
});
