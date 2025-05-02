import { parseCss } from "./parse.js";
import { jest } from "@jest/globals";

describe("parseCss", () => {
  // Mock job and events for testing
  let mockJob;
  let mockEvents;
  let mockNext;
  let requestedUrls;

  beforeEach(() => {
    requestedUrls = [];
    mockJob = {
      data: {
        uri: "https://example.com/styles/main.css",
        id: "test-job-id",
      },
      log: jest.fn(),
    };
    mockEvents = {
      emit: jest.fn((eventName, data) => {
        if (eventName === "createRequestJob") {
          requestedUrls.push(data.uri);
        }
      }),
    };
    mockNext = jest.fn();
  });

  test("parses CSS with local imports", async () => {
    const cssWithLocalImports = `
      @import "typography.css";
      @import "colors.css";
      
      body {
        font-family: sans-serif;
      }
    `;

    await parseCss(
      {
        job: mockJob,
        events: mockEvents,
        data: cssWithLocalImports,
      },
      mockNext,
    );

    // Verify the imports were processed
    expect(requestedUrls).toContain(
      "https://example.com/styles/typography.css",
    );
    expect(requestedUrls).toContain("https://example.com/styles/colors.css");
    expect(mockNext).toHaveBeenCalled();
    expect(mockJob.log).toHaveBeenCalledWith("parseCss start");
    expect(mockJob.log).toHaveBeenCalledWith("parseCss done");
  });

  test("parses CSS with absolute URL imports", async () => {
    const cssWithAbsoluteImports = `
      @import "https://cdn.example.com/framework.css";
      @import url("https://fonts.example.com/font.css");
      
      body {
        background-color: #f5f5f5;
      }
    `;

    await parseCss(
      {
        job: mockJob,
        events: mockEvents,
        data: cssWithAbsoluteImports,
      },
      mockNext,
    );

    // Verify the absolute URLs were processed correctly
    expect(requestedUrls).toContain("https://cdn.example.com/framework.css");
    expect(requestedUrls).toContain("https://fonts.example.com/font.css");
    expect(mockNext).toHaveBeenCalled();
  });

  test("parses CSS with mixed import formats", async () => {
    const cssWithMixedImports = `
      @import url("layout.css");
      @import 'theme.css';
      @import url(print.css);
      @import "https://cdn.example.com/reset.css";
      
      .container {
        max-width: 1200px;
      }
    `;

    await parseCss(
      {
        job: mockJob,
        events: mockEvents,
        data: cssWithMixedImports,
      },
      mockNext,
    );

    // Verify all import formats were processed correctly
    expect(requestedUrls).toContain("https://example.com/styles/layout.css");
    expect(requestedUrls).toContain("https://example.com/styles/theme.css");
    expect(requestedUrls).toContain("https://example.com/styles/print.css");
    expect(requestedUrls).toContain("https://cdn.example.com/reset.css");
    expect(mockNext).toHaveBeenCalled();
  });

  test("parses CSS with background images", async () => {
    const cssWithBackgroundImages = `
      .hero {
        background-image: url('../images/hero.jpg');
      }
      
      .icon {
        background: url('icons/sprite.png') no-repeat;
      }
      
      .logo {
        background-image: url("https://example.com/logo.svg");
      }
    `;

    await parseCss(
      {
        job: mockJob,
        events: mockEvents,
        data: cssWithBackgroundImages,
      },
      mockNext,
    );

    // Verify background images were processed
    expect(requestedUrls).toContain("https://example.com/images/hero.jpg");
    expect(requestedUrls).toContain(
      "https://example.com/styles/icons/sprite.png",
    );
    expect(requestedUrls).toContain("https://example.com/logo.svg");
    expect(mockNext).toHaveBeenCalled();
  });

  test("parses CSS with font-face definitions", async () => {
    const cssWithFonts = `
      @font-face {
        font-family: 'CustomFont';
        src: url('fonts/custom.woff2') format('woff2'),
             url('fonts/custom.woff') format('woff'),
             url('https://fonts.example.com/custom.ttf') format('truetype');
      }
    `;

    await parseCss(
      {
        job: mockJob,
        events: mockEvents,
        data: cssWithFonts,
      },
      mockNext,
    );

    // Verify font files were processed
    expect(requestedUrls).toContain(
      "https://example.com/styles/fonts/custom.woff2",
    );
    expect(requestedUrls).toContain(
      "https://example.com/styles/fonts/custom.woff",
    );
    expect(requestedUrls).toContain("https://fonts.example.com/custom.ttf");
    expect(mockNext).toHaveBeenCalled();
  });

  test("handles empty CSS", async () => {
    await parseCss(
      {
        job: mockJob,
        events: mockEvents,
        data: "",
      },
      mockNext,
    );

    expect(requestedUrls).toHaveLength(0);
    expect(mockNext).toHaveBeenCalled();
  });

  test("handles malformed CSS gracefully", async () => {
    const malformedCss = `
      @import "valid.css";
      @import url(
      
      .unclosed-block {
        color: red;
    `;

    // The implementation doesn't throw on malformed CSS, it processes what it can
    await parseCss(
      {
        job: mockJob,
        events: mockEvents,
        data: malformedCss,
      },
      mockNext,
    );

    // Should still process the valid import before failing
    expect(requestedUrls).toContain("https://example.com/styles/valid.css");
    // Verify the next callback was called
    expect(mockNext).toHaveBeenCalled();
  });
});
