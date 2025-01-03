import { jest } from "@jest/globals";

import { isPathValid, isDomainValid } from "./request";
import { isAlreadyRequested } from "./general";

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

  describe("isAlreadyRequested", () => {
    const mockRequestTracker = {
      hasBeenRequested: jest.fn(),
      markAsRequested: jest.fn(),
    };

    it("should allow new requests", () => {
      mockRequestTracker.hasBeenRequested.mockReturnValue(false);

      const params = {
        job: mockJob,
        tracker: mockRequestTracker,
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
        tracker: mockRequestTracker,
        getKey: (job) => job.data.uri,
      };

      isAlreadyRequested(params, mockNext);

      expect(mockNext).toHaveBeenCalledWith(null, true);
      expect(mockRequestTracker.markAsRequested).not.toHaveBeenCalled();
    });
  });
});
