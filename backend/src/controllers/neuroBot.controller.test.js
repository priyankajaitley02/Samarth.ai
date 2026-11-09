import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/neuroBot.service.js", () => ({
  detectLanguage: vi.fn(),
  processConversationalTurn: vi.fn(),
  generateMedicalReport: vi.fn()
}));

vi.mock("../models/NeuroBotAssessment.js", () => ({
  default: {
    findOneAndUpdate: vi.fn()
  }
})); 

import NeuroBotAssessment from "../models/NeuroBotAssessment.js";
import { generateMedicalReport } from "../services/neuroBot.service.js";
import { generateReport, startSession } from "./neuroBot.controller.js";

describe("NeuroBot failed report persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    NeuroBotAssessment.findOneAndUpdate.mockResolvedValue({ _id: "assessment-123" });
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
    await startSession({ user: { _id: "user-123" }, body: { userId: "other-user" } }, startResponse);
    const { sessionId } = startResponse.json.mock.calls[0][0];

    const response = { json: vi.fn() };
    await generateReport({ user: { _id: "user-123" }, body: { sessionId } }, response);

    const [lookup, update] = NeuroBotAssessment.findOneAndUpdate.mock.calls[0];
    expect(lookup).toMatchObject({ userId: "user-123", sessionId });
    expect(update.$set.status).toBe("FAILED");
    expect(update.$set.failureReason).toBe("ECONNABORTED");
    expect(update.$set.report.failureReason).toBe("ECONNABORTED");

    const payload = response.json.mock.calls[0][0];
    expect(payload.generationStatus).toBe("FAILED");
    expect(payload.assessmentId).toBe("assessment-123");
    expect(payload.failureReason).toBe("ECONNABORTED");
    expect(payload.generationError).toBe(
      "AI report generation is temporarily unavailable."
    );
  });

  it("does not allow another user to generate a session report", async () => {
    const startResponse = { json: vi.fn() };
    await startSession({ user: { _id: "user-123" }, body: {} }, startResponse);
    const { sessionId } = startResponse.json.mock.calls[0][0];
    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };

    await generateReport({ user: { _id: "different-user" }, body: { sessionId } }, response);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(NeuroBotAssessment.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
