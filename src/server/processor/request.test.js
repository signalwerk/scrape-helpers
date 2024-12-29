import { jest } from "@jest/globals";

import { isPathValid, isDomainValid, isAlreadyRequested } from "./request";

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
    it("should allow paths that match allowed patterns", () => {
      const params = {
        job: mockJob,
        allowed: [/^\/path/, "/path?query=1"],
      };

      isPathValid(params, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should reject paths that match disallowed patterns", () => {
      const params = {
        job: mockJob,
        allowed: [/^\/path/],
        disallowed: [/query=1$/],
      };

      isPathValid(params, mockNext);

      expect(mockNext).toHaveBeenCalledWith(null, true);
    });

    it("should throw error for invalid URLs", () => {
      const params = {
        job: { data: { uri: "invalid-url" } },
        allowed: [],
      };

      expect(() => isPathValid(params, mockNext)).toThrow(
        "Error occurred while parsing the URL.",
      );
    });
  });

  describe("isDomainValid", () => {
    it("should allow domains that match allowed patterns", () => {
      const params = {
        job: mockJob,
        allowed: ["example.com", /\.com$/],
      };

      isDomainValid(params, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should reject domains that match disallowed patterns", () => {
      const params = {
        job: mockJob,
        allowed: [/.*/],
        disallowed: ["example.com"],
      };

      isDomainValid(params, mockNext);

      expect(mockNext).toHaveBeenCalledWith(null, true);
    });
  });

  describe("isAlreadyRequested", () => {
    const mockRequestTracker = {
      hasBeenRequested: jest.fn(),
      markAsRequested: jest.fn(),
    };

    it("should allow new requests", () => {
      mockRequestTracker.hasBeenRequested.mockReturnValue(false);

      const params = {
        job: mockJob,
        requestTracker: mockRequestTracker,
        getKey: (job) => job.data.uri,
      };

      isAlreadyRequested(params, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockRequestTracker.markAsRequested).toHaveBeenCalledWith(
        mockJob.data.uri,
      );
    });

    it("should reject duplicate requests", () => {
      mockRequestTracker.hasBeenRequested.mockReturnValue(true);

      const params = {
        job: mockJob,
        requestTracker: mockRequestTracker,
        getKey: (job) => job.data.uri,
      };

      isAlreadyRequested(params, mockNext);

      expect(mockNext).toHaveBeenCalledWith(null, true);
      expect(mockRequestTracker.markAsRequested).not.toHaveBeenCalled();
    });
  });
});
