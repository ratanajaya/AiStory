import type { LLMService, LlmConfig } from "@/types";
import _util from "@/utils/_util";

const supportedLlmServices = ["together", "openAi"] as const satisfies readonly LLMService[];

export function isSupportedLlmService(service: unknown): service is LLMService {
  return typeof service === "string" && supportedLlmServices.includes(service as LLMService);
}

export function getUnsupportedLlmMessage(service: unknown) {
  if (service === "mistral") {
    return "Mistral is no longer supported; update settings to Together AI or OpenAI.";
  }
  return "Unsupported LLM service configured.";
}

type LlmValidationResult =
  | { ok: true; value: LlmConfig | null }
  | { ok: false; message: string };

export function validateLlmConfig(
  input: unknown,
  options: { allowNull?: boolean } = {}
): LlmValidationResult {
  if (input == null) {
    if (options.allowNull) {
      return { ok: true, value: null };
    }
    return { ok: false, message: "LLM provider and model are required." };
  }

  if (typeof input !== "object") {
    return { ok: false, message: "LLM settings must be an object." };
  }

  const candidate = input as { service?: unknown; model?: unknown };
  if (!isSupportedLlmService(candidate.service)) {
    return { ok: false, message: getUnsupportedLlmMessage(candidate.service) };
  }

  const model = typeof candidate.model === "string"
    ? _util.toInputString(candidate.model)
    : "";

  if (!model) {
    return { ok: false, message: "LLM model is required." };
  }

  return {
    ok: true,
    value: {
      service: candidate.service,
      model,
    },
  };
}

export function assertSupportedLlmConfig(selectedLlm: LlmConfig) {
  if (!isSupportedLlmService(selectedLlm.service)) {
    throw new Error(getUnsupportedLlmMessage(selectedLlm.service));
  }

  if (_util.isNullOrWhitespace(selectedLlm.model)) {
    throw new Error("LLM model is not configured");
  }
}
