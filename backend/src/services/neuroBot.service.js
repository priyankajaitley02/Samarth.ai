import axios from "axios";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL?.trim() || null;
const GEMINI_REQUEST_TIMEOUT_MS = readBoundedInteger(
  process.env.GEMINI_REQUEST_TIMEOUT_MS,
  30000,
  1000,
  30000
);
const GEMINI_MAX_ATTEMPTS = readBoundedInteger(
  process.env.GEMINI_MAX_ATTEMPTS,
  3, 
  1,
  3
);
const GEMINI_RETRY_BASE_DELAY_MS = readBoundedInteger(
  process.env.GEMINI_RETRY_BASE_DELAY_MS,
  500,
  1,
  5000
);
const GEMINI_MAX_RETRY_DELAY_MS = readBoundedInteger(
  process.env.GEMINI_MAX_RETRY_DELAY_MS,
  5000,
  1,
  30000
);

// MIET AI Services (DGX) configuration and fallback models
const DEFAULT_NEUROBOT_MODELS = [
  "qwen3.5:9b",
  "qwen3.6:35b",
  "gemma3:27b",
  "gpt-oss:20b",
  "qwen3:32b",
  "deepseek-r1:70b",
  "qwen3.5:122b",
  "gpt-oss:120b"
];

function getExternalProviderConfig() {
  const endpoint = (process.env.NEUROBOT_INFERENCE_URL || process.env.LLM_API_URL || "").trim();
  const apiKey = (process.env.NEUROBOT_API_KEY || process.env.LLM_API_KEY || "").trim();
  const primaryModel = (process.env.NEUROBOT_MODEL || process.env.LLM_MODEL || "qwen3.5:9b").trim();
  const fallbacksStr = process.env.NEUROBOT_FALLBACK_MODELS || process.env.LLM_FALLBACK_MODELS || "";
  const configuredFallbacks = fallbacksStr.split(",").map((m) => m.trim()).filter(Boolean);
  const models = Array.from(new Set([primaryModel, ...configuredFallbacks, ...DEFAULT_NEUROBOT_MODELS]));

  return {
    endpoint: endpoint || null,
    apiKey: apiKey || null,
    model: primaryModel,
    models
  };
}

const SAFE_GENERATION_ERROR =
  "AI report generation is temporarily unavailable. Please try again later.";

console.info("[Gemini] Runtime configuration", {
  model: GEMINI_MODEL,
  workingDirectory: process.cwd()
});

function readBoundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed)
    ? Math.min(maximum, Math.max(minimum, parsed))
    : fallback;
}

function sanitizeCode(code) {
  return typeof code === "string" && /^[A-Z0-9_]+$/.test(code)
    ? code
    : "UNKNOWN";
}

function getRequestId(headers) {
  const candidates = [
    headers?.["x-goog-request-id"],
    headers?.["x-request-id"],
    headers?.["x-cloud-trace-context"]?.split("/")[0],
    headers?.traceparent?.split("-")[1]
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    if (/^[A-Za-z0-9._:-]{1,128}$/.test(candidate)) return candidate;
  }

  return null;
}

function collectSensitiveValues(value, values = []) {
  if (typeof value === "string" && value.length >= 3) {
    values.push(value);
  } else if (Array.isArray(value)) {
    value.forEach((item) => collectSensitiveValues(item, values));
  } else if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectSensitiveValues(item, values));
  }

  return values;
}

function sanitizeProviderMessage(error, sensitiveValues = []) {
  const message = error.response?.data?.error?.message;
  if (typeof message !== "string") return null;

  let sanitized = message.replace(/[\r\n\t]+/g, " ").trim();
  const valuesToRedact = [GEMINI_API_KEY, ...sensitiveValues]
    .filter((value) => typeof value === "string" && value.length >= 3)
    .sort((left, right) => right.length - left.length);

  for (const value of valuesToRedact) {
    sanitized = sanitized.split(value).join("[redacted]");
  }

  return sanitized.slice(0, 240);
}

function parseRetryAfter(value) {
  if (typeof value !== "string") return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.ceil(seconds * 1000);
  }

  const retryAt = Date.parse(value);
  return Number.isNaN(retryAt) ? null : Math.max(0, retryAt - Date.now());
}

function isTransientRequestError(error) {
  if (error.response) {
    return error.response.status === 429 ||
      (error.response.status >= 500 && error.response.status <= 599);
  }

  return new Set([
    "ECONNABORTED",
    "ETIMEDOUT",
    "ECONNRESET",
    "EAI_AGAIN",
    "ENOTFOUND",
    "ECONNREFUSED",
    "EPIPE",
    "ERR_NETWORK"
  ]).has(error.code);
}

class GeminiRequestError extends Error {
  constructor({
    code,
    status,
    requestId,
    attemptCount,
    durationMs,
    model = null,
    failoverEligible = false
  }) {
    super("Gemini request failed");
    this.name = "GeminiRequestError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.attemptCount = attemptCount;
    this.durationMs = durationMs;
    this.model = model;
    this.failoverEligible = failoverEligible;
  }
}

function getRetryDelay(error, retryIndex) {
  const retryAfter = parseRetryAfter(error.response?.headers?.["retry-after"]);
  if (retryAfter !== null) {
    return retryAfter <= GEMINI_MAX_RETRY_DELAY_MS ? retryAfter : null;
  }

  const backoff = GEMINI_RETRY_BASE_DELAY_MS * (2 ** retryIndex);
  const jittered = Math.floor(backoff * (0.5 + Math.random()));
  return Math.min(GEMINI_MAX_RETRY_DELAY_MS, jittered);
}

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function isExternalProviderConfigured() {
  const config = getExternalProviderConfig();
  return Boolean(config.endpoint && config.apiKey);
}

async function callExternalProvider(prompt, requestedModel = null, sensitiveValues = []) {
  if (Array.isArray(requestedModel)) {
    sensitiveValues = requestedModel;
    requestedModel = null;
  }
  const startedAt = Date.now();
  const provider = getExternalProviderConfig();
  const candidateModels = requestedModel
    ? Array.from(new Set([requestedModel, ...provider.models]))
    : provider.models;

  let lastError = null;

  for (let i = 0; i < candidateModels.length; i++) {
    const model = candidateModels[i];
    try {
      console.info(`[NeuroBot] Attempting gateway model ${i + 1}/${candidateModels.length}: ${model}`);
      const response = await axios.post(
        provider.endpoint,
        {
          model,
          messages: [{ role: "user", content: prompt }]
        },
        {
          headers: {
            Authorization: `Bearer ${provider.apiKey}`,
            "x-api-key": provider.apiKey,
            "Content-Type": "application/json"
          },
          timeout: GEMINI_REQUEST_TIMEOUT_MS
        }
      );

      const text =
        response.data?.choices?.[0]?.message?.content ||
        response.data?.choices?.[0]?.text ||
        response.data?.output ||
        response.data?.content ||
        response.data?.result ||
        response.data?.response;

      if (typeof text !== "string" || !text.trim()) {
        throw new Error(`External provider model ${model} returned empty text`);
      }

      console.info(`[NeuroBot] Gateway model ${model} succeeded!`);
      return {
        text: text.trim(),
        metadata: {
          status: response.status,
          requestId: getRequestId(response.headers),
          attemptCount: i + 1,
          durationMs: Date.now() - startedAt,
          model
        }
      };
    } catch (error) {
      lastError = error;
      const status = Number.isInteger(error.response?.status)
        ? error.response.status
        : Number.isInteger(error.status)
          ? error.status
          : null;
      const requestId = error.requestId || getRequestId(error.response?.headers);
      const providerMessage = error.response?.data?.error?.message ||
        error.response?.data?.message;

      let safeMessage = typeof providerMessage === "string"
        ? providerMessage.replace(/[\r\n\t]+/g, " ").trim()
        : null;
      for (const value of [provider.apiKey, ...sensitiveValues]) {
        if (typeof value === "string" && value.length >= 3 && safeMessage) {
          safeMessage = safeMessage.split(value).join("[redacted]");
        }
      }

      console.warn("[NeuroBot] External provider model failed", {
        model,
        status,
        requestId,
        code: sanitizeCode(error.code),
        message: safeMessage ? safeMessage.slice(0, 240) : null
      });
    }
  }

  // All external models failed
  const finalStatus = Number.isInteger(lastError?.response?.status)
    ? lastError.response.status
    : null;
  const finalRequestId = getRequestId(lastError?.response?.headers);
  const requestError = new GeminiRequestError({
    code: sanitizeCode(lastError?.code),
    status: finalStatus,
    requestId: finalRequestId,
    attemptCount: candidateModels.length,
    durationMs: Date.now() - startedAt,
    model: candidateModels[0],
    failoverEligible: true
  });
  requestError.sensitiveValues = sensitiveValues;
  throw requestError;
}

// =========================
// 1. CALL GEMINI API
// =========================
async function callLLM(prompt, model = GEMINI_MODEL, sensitiveValues = []) {
  const startedAt = Date.now();
  if (!GEMINI_API_KEY) {
    throw new GeminiRequestError({
      code: "CONFIGURATION_MISSING",
      status: null,
      requestId: null,
      attemptCount: 0,
      durationMs: Date.now() - startedAt,
      model,
      failoverEligible: false
    });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  let response;
  let attemptCount = 0;

  while (attemptCount < GEMINI_MAX_ATTEMPTS) {
    attemptCount += 1;
    const attemptStartedAt = Date.now();
    let attemptDurationMs;
    let requestError;
    try {
      response = await axios.post(
        url,
        {
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json"
          }
        },
        {
          headers: {
            "x-goog-api-key": GEMINI_API_KEY,
            "Content-Type": "application/json"
          },
          timeout: GEMINI_REQUEST_TIMEOUT_MS
        }
      );
    } catch (error) {
      requestError = error;
    } finally {
      attemptDurationMs = Date.now() - attemptStartedAt;
    }

    if (requestError) {
      const retryable = isTransientRequestError(requestError);
      const httpStatus = Number.isInteger(requestError.response?.status)
        ? requestError.response.status
        : null;
      const requestId = getRequestId(requestError.response?.headers);

      console.warn("[Gemini] Request attempt failed", {
        model,
        attempt: attemptCount,
        durationMs: Date.now() - startedAt,
        attemptDurationMs,
        httpStatus,
        providerErrorStatus:
          typeof requestError.response?.data?.error?.status === "string"
            ? requestError.response.data.error.status.slice(0, 80)
            : null,
        providerErrorMessage: sanitizeProviderMessage(requestError, sensitiveValues),
        requestId,
        code: sanitizeCode(requestError.code)
      });

      if (!retryable || attemptCount >= GEMINI_MAX_ATTEMPTS) {
        throw new GeminiRequestError({
          code: sanitizeCode(requestError.code),
          status: httpStatus,
          requestId,
          attemptCount,
          durationMs: Date.now() - startedAt,
          model,
          failoverEligible:
            (requestError.response?.status >= 500 && requestError.response?.status <= 599) ||
            (!requestError.response && isTransientRequestError(requestError))
        });
      }

      const retryDelay = getRetryDelay(requestError, attemptCount - 1);
      if (retryDelay === null) {
        throw new GeminiRequestError({
          code: sanitizeCode(requestError.code),
          status: httpStatus,
          requestId,
          attemptCount,
          durationMs: Date.now() - startedAt,
          model,
          failoverEligible:
            (requestError.response?.status >= 500 && requestError.response?.status <= 599) ||
            (!requestError.response && isTransientRequestError(requestError))
        });
      }

      await delay(retryDelay);
    } else {
      console.info("[Gemini] Request attempt succeeded", {
        model,
        attempt: attemptCount,
        durationMs: Date.now() - startedAt,
        attemptDurationMs,
        httpStatus: response.status,
        requestId: getRequestId(response.headers)
      });
      break;
    }
  }

  const text = response.data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();

  if (!text) {
    const error = new Error("Gemini returned no text");
    error.code = "EMPTY_RESPONSE";
    error.status = response.status;
    error.requestId = getRequestId(response.headers);
    error.attemptCount = attemptCount;
    error.durationMs = Date.now() - startedAt;
    error.model = model;
    throw error;
  }

  return {
    text,
    metadata: {
      status: response.status,
      requestId: getRequestId(response.headers),
      attemptCount,
      durationMs: Date.now() - startedAt,
      model
    }
  };
}

// =========================
// 2. EXTRACT JSON RESPONSE
// =========================
function extractJsonString(text) {
  if (!text) return "";

  let jsonStr = text.trim();

  // Remove optional Markdown code fences.
  jsonStr = jsonStr
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const firstBrace = jsonStr.indexOf("{");
  const lastBrace = jsonStr.lastIndexOf("}");

  if (
    firstBrace !== -1 &&
    lastBrace !== -1 &&
    lastBrace >= firstBrace
  ) {
    jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
  }

  return jsonStr;
}

// =========================
// 3. SANITIZE JSON RESPONSE
// =========================
function sanitizeJsonString(jsonStr) {
  let result = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < jsonStr.length; i += 1) {
    const ch = jsonStr[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        result += ch;
        continue;
      }

      if (ch === "\\") {
        escaped = true;
        result += ch;
        continue;
      }

      if (ch === '"') {
        inString = false;
        result += ch;
        continue;
      }

      // Escape raw control characters inside JSON strings.
      if (ch === "\n") {
        result += "\\n";
        continue;
      }

      if (ch === "\r") {
        result += "\\r";
        continue;
      }

      if (ch === "\t") {
        result += "\\t";
        continue;
      }

      result += ch;
      continue;
    }

    if (ch === '"') {
      inString = true;
    }

    result += ch;
  }

  // Remove trailing commas before closing braces or brackets.
  return result.replace(/,\s*([}\]])/g, "$1");
}

// =========================
// 4. PARSE LLM JSON
// =========================
function parseLlmJson(text) {
  if (typeof text === "object" && text !== null) {
    return text;
  }

  const raw = extractJsonString(text);

  if (!raw) {
    throw new Error("Empty JSON response from Gemini");
  }

  try {
    return JSON.parse(raw);
  } catch {
    const sanitized = sanitizeJsonString(raw);
    return JSON.parse(sanitized);
  }
}

// =========================
// 5. DETECT LANGUAGE
// =========================
export function detectLanguage(text) {
  if (!text) return "en";

  const lower = text.toLowerCase();

  if (
    lower.includes("hindi") ||
    lower.includes("hndi") ||
    lower.includes("india") ||
    lower.trim() === "hi" ||
    /[\u0900-\u0D7F]/.test(text)
  ) {
    return "hi";
  }

  return "en";
}

// =========================
// 6. PROCESS CONVERSATIONAL TURN
// =========================
export async function processConversationalTurn(
  history,
  currentData,
  lang
) {
  const prompt = `
You are an AI assistant conducting a neurological screening.
This screening is not a medical diagnosis.

Your goal is to ask 8 to 10 concise questions covering:
1. Patient's age
2. Recent memory loss
3. Difficulty performing familiar daily tasks
4. Confusion about time or place
5. Trouble understanding visual or spatial relationships
6. Problems with words when speaking or writing
7. Misplacing things or difficulty retracing steps
8. Decreased or poor judgment
9. Withdrawal from work, hobbies, or social activities
10. Changes in mood or personality

Currently extracted data:
${JSON.stringify(currentData)}

Conversation history:
${(history || [])
  .map((h) => `${h.from}: ${h.text}`)
  .join("\n")}

Instructions:
1. Keep responses concise, preferably one or two sentences.
2. Speak naturally and empathetically.
3. If the user asks a question, answer briefly and appropriately.
4. Ask at most one follow-up question per turn.
5. Extract relevant answers and update existing extracted data.
6. Finish after 8 to 10 questions, when the necessary information is collected, or if the user refuses to continue.
7. Use ${
    lang === "hi"
      ? "Hindi, using the script most appropriate to the user's messages"
      : "English"
  }.

Return only a valid JSON object with this structure:
{
  "botText": "Your response to the user",
  "extractedData": {
    "age": "pending",
    "memory": "pending",
    "daily_tasks": "pending"
  },
  "finished": false
}

Include relevant existing extracted data in extractedData.
Do not claim to diagnose Alzheimer's disease or Parkinson's disease.
`;

  try {
    let text;
    if (isExternalProviderConfigured()) {
      try {
        const extResult = await callExternalProvider(
          prompt,
          getExternalProviderConfig().model,
          collectSensitiveValues(conversation)
        );
        text = extResult.text;
      } catch (extError) {
        console.warn("[NeuroBot] External provider failed for conversational turn, attempting Gemini fallback:", extError.message);
        if (GEMINI_API_KEY) {
          const geminiResult = await callLLM(prompt);
          text = geminiResult.text;
        } else {
          throw extError;
        }
      }
    } else {
      const geminiResult = await callLLM(prompt);
      text = geminiResult.text;
    }

    const result = parseLlmJson(text);

    if (
      !result ||
      typeof result.botText !== "string" ||
      typeof result.extractedData !== "object"
    ) {
      throw new Error("AI provider returned an unexpected conversation format");
    }

    return result;
  } catch (error) {
    console.error(
      "Conversational Turn Failed:",
      error.response?.data || error.message
    );

    return {
      botText:
        lang === "hi"
          ? "मुझे आपका जवाब समझने में परेशानी हुई। कृपया फिर से बताएं।"
          : "I'm having trouble processing that right now. Could you repeat?",
      extractedData: currentData || {},
      finished: false
    };
  }
}

// =========================
// 7. GENERATE MEDICAL REPORT
// =========================
export async function generateMedicalReport(answers, lang) {
  const startedAt = Date.now();
  const prompt = `
You are an AI assistant preparing a patient-friendly neurological screening report.
This report is for screening support only and is not a medical diagnosis.

Report language: ${lang === "hi" ? "Hindi" : "English"}

Screening answers:
${JSON.stringify(answers, null, 2)}

Instructions:
1. Summarize the reported answers clearly and empathetically.
2. Assess whether the reported answers suggest a low, medium, or high need for further clinical assessment.
3. Explain the basis for the assessment without claiming that the person has Alzheimer's disease, Parkinson's disease, or another condition.
4. Give practical recommendations, including professional medical evaluation when appropriate.
5. Do not invent symptoms, patient details, test results, or medical history.
6. If the answers are insufficient, state that the assessment is limited and recommend a professional evaluation.
7. Return only valid JSON with exactly these fields:

{
  "summary": "Patient-friendly summary",
  "riskLevel": "Low",
  "reasoning": "Explanation based on the answers and limitations",
  "recommendations": [
    "Recommendation one",
    "Recommendation two"
  ]
}

riskLevel must be one of the strings "Low", "Medium", or "High".
Do not include Markdown formatting or text outside the JSON object.
`;

  const generateForModel = async (model, request = callLLM) => {
    const { text, metadata } = await request(
      prompt,
      model,
      collectSensitiveValues(answers)
    );
    const report = parseLlmJson(text);

    const validRiskLevels = ["Low", "Medium", "High"];

    if (
      !report ||
      typeof report.summary !== "string" ||
      !validRiskLevels.includes(report.riskLevel) ||
      typeof report.reasoning !== "string" ||
      !Array.isArray(report.recommendations)
    ) {
      const error = new Error("Gemini returned an invalid report structure");
      error.code = "INVALID_RESPONSE";
      error.status = metadata.status;
      error.requestId = metadata.requestId;
      error.attemptCount = metadata.attemptCount;
      error.durationMs = metadata.durationMs;
      error.model = model;
      throw error;
    }

    return { report, metadata };
  };

  let generation;
  let generationModel = GEMINI_MODEL;
  const externalConfig = getExternalProviderConfig();

  try {
    if (isExternalProviderConfigured()) {
      generation = await generateForModel(
        externalConfig.model,
        callExternalProvider
      );
      generationModel = generation?.metadata?.model || externalConfig.model;
    } else {
      generation = await generateForModel(GEMINI_MODEL);
    }
  } catch (error) {
    console.error(
      isExternalProviderConfigured()
        ? "[NeuroBot] External provider attempt failed"
        : "[Gemini] Model attempt failed",
      {
        model: isExternalProviderConfigured()
          ? externalConfig.model
          : GEMINI_MODEL,
        durationMs: error.durationMs ?? Date.now() - startedAt,
        status: Number.isInteger(error.status) ? error.status : null,
        attemptCount: error.attemptCount ?? 0,
        requestId: error.requestId ?? null,
        code: sanitizeCode(error.code)
      }
    );

    const externalProviderConfigured = isExternalProviderConfigured();
    const failoverEligible = externalProviderConfigured
      ? error.failoverEligible !== false
      : error.failoverEligible;

    if (
      !failoverEligible ||
      (externalProviderConfigured &&
        !GEMINI_API_KEY) ||
      (!externalProviderConfigured &&
        (!GEMINI_FALLBACK_MODEL ||
          GEMINI_FALLBACK_MODEL === GEMINI_MODEL))
    ) {
      return createFailedGeneration(error, startedAt);
    }

    generationModel = isExternalProviderConfigured()
      ? GEMINI_MODEL
      : GEMINI_FALLBACK_MODEL;
    try {
      generation = await generateForModel(generationModel);
    } catch (fallbackError) {
      console.error("[Gemini] Model attempt failed", {
        model: generationModel,
        durationMs: fallbackError.durationMs ?? Date.now() - startedAt,
        status: Number.isInteger(fallbackError.status)
          ? fallbackError.status
          : null,
        attemptCount: fallbackError.attemptCount ?? 0,
        requestId: fallbackError.requestId ?? null,
        code: sanitizeCode(fallbackError.code)
      });
      return createFailedGeneration(fallbackError, startedAt);
    }
  }

  console.info("[Gemini] Report generated", {
      model: generationModel,
      durationMs: Date.now() - startedAt,
      status: generation.metadata.status,
      attemptCount: generation.metadata.attemptCount,
      requestId: generation.metadata.requestId
    });

  return {
      report: generation.report,
      generationStatus: "SUCCEEDED",
      generationModel,
      error: null
  };
}

function createFailedGeneration(error, startedAt) {
  const diagnostics = {
    model: error.model ?? GEMINI_MODEL,
    durationMs: error.durationMs ?? Date.now() - startedAt,
    status: Number.isInteger(error.status) ? error.status : null,
    attemptCount: error.attemptCount ?? 0,
    requestId: error.requestId ?? null,
    code: sanitizeCode(error.code)
  };
  console.error("[Gemini] Report generation failed", diagnostics);

  return {
    report: {
      summary: "An AI-generated report could not be produced.",
      riskLevel: "Unknown",
      reasoning: "No AI assessment is available because report generation failed.",
      recommendations: [
        "Please consult a qualified healthcare professional for assessment."
      ],
      isFallback: true,
      generationStatus: "FAILED"
    },
    generationStatus: "FAILED",
    generationModel: null,
    error: SAFE_GENERATION_ERROR,
    diagnostics: {
      model: diagnostics.model,
      code: diagnostics.code,
      status: diagnostics.status
    }
  };
}
