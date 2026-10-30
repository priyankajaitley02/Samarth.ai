import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";

vi.mock("axios", () => ({
  default: {
    post: vi.fn()
  }
}));

import axios from "axios";

const validReport = {
  summary: "Screening summary",
  riskLevel: "Low",
  reasoning: "Based on the provided answers.",
  recommendations: ["Discuss concerns with a qualified professional."]
};

const successResponse = (report = validReport) => ({
  status: 200,
  headers: { "x-goog-request-id": "request-123" },
  data: {
    candidates: [{
      content: {
        parts: [{ text: JSON.stringify(report) }]
      }
    }]
  }
});

const providerError = (status, headers = {}, code = "ERR_BAD_RESPONSE") => {
  const error = new Error("Mock provider failure");
  error.code = code;
  error.response = { status, headers, data: { message: "not for logs" } };
  return error;
};

describe("Gemini report generation reliability", () => {
  let generateMedicalReport;

  beforeAll(async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL", "test-model");
    vi.stubEnv("GEMINI_FALLBACK_MODEL", "fallback-test-model");
    vi.stubEnv("GEMINI_REQUEST_TIMEOUT_MS", "120000");
    vi.stubEnv("GEMINI_MAX_ATTEMPTS", "8");
    vi.stubEnv("GEMINI_RETRY_BASE_DELAY_MS", "1");
    vi.stubEnv("GEMINI_MAX_RETRY_DELAY_MS", "20");
    ({ generateMedicalReport } = await import("./neuroBot.service.js"));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Math, "random").mockReturnValue(0);
  });

  afterAll(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("returns a successful parsed AI report", async () => {
    axios.post.mockResolvedValueOnce(successResponse());

    const result = await generateMedicalReport({ answer: "test" }, "en");

    expect(result).toEqual({
      report: validReport,
      generationStatus: "SUCCEEDED",
      generationModel: "test-model",
      error: null
    });
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post.mock.calls[0][2].timeout).toBe(30000);
  });

  it("retries a timeout and reports failure if the retry also times out", async () => {
    const timeout = new Error("timeout");
    timeout.code = "ECONNABORTED";
    axios.post.mockRejectedValue(timeout);

    const result = await generateMedicalReport({}, "en");

    expect(axios.post).toHaveBeenCalledTimes(6);
    expect(result.generationStatus).toBe("FAILED");
    expect(result.report.isFallback).toBe(true);
    expect(result.diagnostics.code).toBe("ECONNABORTED");
    expect(result.diagnostics.status).toBeNull();
  });

  it("retries HTTP 503 and returns a report if a later attempt succeeds", async () => {
    axios.post
      .mockRejectedValueOnce(providerError(503))
      .mockResolvedValueOnce(successResponse());

    const result = await generateMedicalReport({}, "en");

    expect(axios.post).toHaveBeenCalledTimes(2);
    expect(result.generationStatus).toBe("SUCCEEDED");
    expect(result.generationModel).toBe("test-model");
    expect(result.report).toEqual(validReport);
  });

  it("uses the configured fallback model after primary HTTP 503 retries exhaust", async () => {
    axios.post
      .mockRejectedValueOnce(providerError(503))
      .mockRejectedValueOnce(providerError(503))
      .mockRejectedValueOnce(providerError(503))
      .mockResolvedValueOnce(successResponse());

    const result = await generateMedicalReport({}, "en");

    expect(axios.post).toHaveBeenCalledTimes(4);
    expect(axios.post.mock.calls.slice(0, 3).every(([url]) =>
      url.includes("/models/test-model:")
    )).toBe(true);
    expect(axios.post.mock.calls[3][0]).toContain(
      "/models/fallback-test-model:"
    );
    expect(result.generationStatus).toBe("SUCCEEDED");
    expect(result.generationModel).toBe("fallback-test-model");
    expect(result.report).toEqual(validReport);
  });

  it("preserves failed status when both configured models exhaust retries", async () => {
    axios.post.mockRejectedValue(providerError(503));

    const result = await generateMedicalReport({}, "en");

    expect(axios.post).toHaveBeenCalledTimes(6);
    expect(axios.post.mock.calls.slice(0, 3).every(([url]) =>
      url.includes("/models/test-model:")
    )).toBe(true);
    expect(axios.post.mock.calls.slice(3).every(([url]) =>
      url.includes("/models/fallback-test-model:")
    )).toBe(true);
    expect(result.generationStatus).toBe("FAILED");
    expect(result.generationModel).toBeNull();
    expect(result.report.isFallback).toBe(true);
    expect(result.report.riskLevel).toBe("Unknown");
    expect(result.diagnostics.model).toBe("fallback-test-model");
  });

  it("honors Retry-After for HTTP 429 before retrying", async () => {
    axios.post
      .mockRejectedValueOnce(providerError(429, { "retry-after": "0" }))
      .mockResolvedValueOnce(successResponse());

    const result = await generateMedicalReport({}, "en");

    expect(axios.post).toHaveBeenCalledTimes(2);
    expect(result.generationStatus).toBe("SUCCEEDED");
  });

  it("does not retry invalid API-key responses and does not expose provider data", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const invalidKey = providerError(401, {}, "ERR_BAD_REQUEST");
    invalidKey.response.data = {
      error: {
        message: "Invalid API key",
        status: "UNAUTHENTICATED"
      }
    };
    axios.post.mockRejectedValue(invalidKey);

    const result = await generateMedicalReport({}, "en");

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(result.generationStatus).toBe("FAILED");
    expect(result.error).not.toContain("test-key");
    expect(log.mock.calls.flat().join(" ")).not.toContain("not for logs");
    expect(log.mock.calls.flat().join(" ")).not.toContain("test-key");
    const loggedProviderError = JSON.stringify(warning.mock.calls);
    expect(loggedProviderError).toContain("Invalid API key");
    expect(loggedProviderError).not.toContain("test-key");
  });

  it("logs sanitized provider diagnostics without credentials or screening answers", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const answer = "private screening detail";
    const apiKey = "test-key";
    const failure = providerError(503, {
      "x-cloud-trace-context": "trace-456/123;o=1"
    });
    failure.response.data = {
      error: {
        message: `Unavailable for ${answer}; credential ${apiKey}`,
        status: "UNAVAILABLE"
      },
      sensitivePayload: answer
    };
    axios.post.mockRejectedValue(failure);

    await generateMedicalReport({ response: answer }, "en");

    const logged = JSON.stringify(warning.mock.calls);
    expect(logged).toContain('"httpStatus":503');
    expect(logged).toContain('"providerErrorStatus":"UNAVAILABLE"');
    expect(logged).toContain("Unavailable for [redacted]; credential [redacted]");
    expect(logged).toContain('"requestId":"trace-456"');
    expect(logged).toContain('"attempt":1');
    expect(logged).not.toContain(apiKey);
    expect(logged).not.toContain(answer);
    expect(logged).not.toContain("sensitivePayload");
  });

  it("caps each model at two retries and 30-second requests", async () => {
    axios.post.mockRejectedValue(providerError(503));

    const result = await generateMedicalReport({}, "en");

    expect(axios.post).toHaveBeenCalledTimes(6);
    expect(axios.post.mock.calls.every(([, , config]) =>
      config.timeout === 30000
    )).toBe(true);
    expect(result.generationStatus).toBe("FAILED");
    expect(result.diagnostics.status).toBe(503);
  });
});

describe("MIET AI Services gateway fallback reliability", () => {
  let generateMedicalReport;

  beforeAll(async () => {
    vi.stubEnv("NEUROBOT_INFERENCE_URL", "https://ai-services.mietjmu.in/gateway/llm/chat");
    vi.stubEnv("NEUROBOT_API_KEY", "dgx_test_key");
    vi.stubEnv("NEUROBOT_MODEL", "qwen3.5:9b");
    vi.stubEnv("NEUROBOT_FALLBACK_MODELS", "qwen3.6:35b,gemma3:27b");
    vi.stubEnv("GEMINI_API_KEY", "");
    ({ generateMedicalReport } = await import("./neuroBot.service.js"));
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it("tries fallback gateway model when the primary model fails", async () => {
    // Primary model qwen3.5:9b fails with 403
    axios.post.mockRejectedValueOnce(providerError(403));
    // Fallback model qwen3.6:35b succeeds
    axios.post.mockResolvedValueOnce({
      status: 200,
      headers: { "x-request-id": "dgx-req-1" },
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify(validReport)
            }
          }
        ]
      }
    });

    const result = await generateMedicalReport({ answer: "test" }, "en");

    expect(result.generationStatus).toBe("SUCCEEDED");
    expect(result.generationModel).toBe("qwen3.6:35b");
    expect(result.report).toEqual(validReport);
    expect(axios.post).toHaveBeenCalledTimes(2);
    expect(axios.post.mock.calls[0][1].model).toBe("qwen3.5:9b");
    expect(axios.post.mock.calls[1][1].model).toBe("qwen3.6:35b");
    expect(axios.post.mock.calls[0][2].headers.Authorization).toBe("Bearer dgx_test_key");
  });
});
