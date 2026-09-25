import type { AiModelOption } from "@/types";
import _util from "@/utils/_util";

const OPENAI_MODELS_URL = "https://api.openai.com/v1/models";

export class OpenAiModelsError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "OpenAiModelsError";
  }
}

// The models API has no modality or endpoint capability field. Limit the
// selector to text-generation families and exclude specialized variants.
export function normalizeOpenAiTextModels(input: unknown): AiModelOption[] {
  if (!input || typeof input !== "object" || !Array.isArray((input as { data?: unknown }).data)) {
    return [];
  }

  return (input as { data: unknown[] }).data.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const rawId = (item as { id?: unknown }).id;
    const id = typeof rawId === "string" ? _util.toInputString(rawId) : "";
    const baseId = id.startsWith("ft:") ? id.slice(3) : id;
    if (
      !/^(?:gpt-(?:3\.5|[4-9])|o[1-9](?:[.-]|$))/.test(baseId) ||
      /(?:audio|realtime|transcribe|tts|image|search|computer|deep-research|video|speech|embedding|moderation)/i.test(baseId)
    ) {
      return [];
    }

    return [{ id, label: id, contextLength: null }];
  });
}

export async function fetchOpenAiTextModels(
  apiKey: string,
  fetchImpl: typeof fetch = fetch
): Promise<AiModelOption[]> {
  const normalizedApiKey = _util.toInputString(apiKey);
  if (!normalizedApiKey) {
    throw new OpenAiModelsError("OpenAI API key is required to load models.", 400);
  }

  const response = await fetchImpl(OPENAI_MODELS_URL, {
    method: "GET",
    headers: { Authorization: `Bearer ${normalizedApiKey}` },
  });

  if (!response.ok) {
    throw new OpenAiModelsError(
      response.status === 401 ? "OpenAI authentication failed." : "OpenAI model request failed.",
      response.status === 401 ? 401 : 502
    );
  }

  return normalizeOpenAiTextModels(await response.json());
}
