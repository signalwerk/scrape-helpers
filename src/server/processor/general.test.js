import { jest } from "@jest/globals";

import { isAlreadyProcessed } from "./general";

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

  describe("isAlreadyProcessed", () => {
    const mockTracker = {
      hasBeenProcessed: jest.fn(),
      markAsProcessed: jest.fn(),
    };

    it("should allow new requests", async () => {
      mockTracker.hasBeenProcessed.mockReturnValue(false);

      const middleware = isAlreadyProcessed({ tracker: 'trackerKey' });
      const context = { trackerKey: mockTracker };
      
      await middleware({ job: mockJob, context }, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockTracker.markAsProcessed).toHaveBeenCalledWith(
        mockJob.data.uri,
      );
    });

    it("should reject duplicate requests", async () => {
      mockTracker.hasBeenProcessed.mockReturnValue(true);

      const middleware = isAlreadyProcessed({ tracker: 'trackerKey' });
      const context = { trackerKey: mockTracker };
      
      await middleware({ job: mockJob, context }, mockNext);

      expect(mockNext).toHaveBeenCalledWith(null, true);
      expect(mockTracker.markAsProcessed).not.toHaveBeenCalled();
    });
  });
});
