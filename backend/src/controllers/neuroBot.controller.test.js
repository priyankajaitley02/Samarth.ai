import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/neuroBot.service.js", () => ({
  detectLanguage: vi.fn(),
  processConversationalTurn: vi.fn(),
  generateMedicalReport: vi.fn()
}));

vi.mock("../models/NeuroBotAssessment.js", () => ({
  default: {
    create: vi.fn()
  }
})); 

import NeuroBotAssessment from "../models/NeuroBotAssessment.js";
import { generateMedicalReport } from "../services/neuroBot.service.js";
import { generateReport, startSession } from "./neuroBot.controller.js";

describe("NeuroBot failed report persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    NeuroBotAssessment.create.mockResolvedValue({ _id: "assessment-123" });
    generateMedicalReport.mockResolvedValue({
      report: {
        summary: "No AI assessment is available.",
        riskLevel: "Unknown",
        reasoning: "Report generation failed.",
        recommendations: []
      },
      generationStatus: "FAILED",
      generationModel: null,
      error: "AI report generation is temporarily unavailable.",
      diagnostics: { code: "ECONNABORTED" }
    });
  });

  it("persists and returns the failure code without changing generation status", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const startResponse = { json: vi.fn() };
    await startSession({ body: { userId: "user-123" } }, startResponse);
    const { sessionId } = startResponse.json.mock.calls[0][0];

    const response = { json: vi.fn() };
    await generateReport({ body: { sessionId } }, response);

    const [savedAssessment] = NeuroBotAssessment.create.mock.calls[0];
    expect(savedAssessment.status).toBe("FAILED");
    expect(savedAssessment.failureReason).toBe("ECONNABORTED");
    expect(savedAssessment.report.failureReason).toBe("ECONNABORTED");

    const payload = response.json.mock.calls[0][0];
    expect(payload.generationStatus).toBe("FAILED");
    expect(payload.failureReason).toBe("ECONNABORTED");
    expect(payload.generationError).toBe(
      "AI report generation is temporarily unavailable."
    );
  });
});
