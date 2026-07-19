import type { AiModelOption } from "@/types";
import _util from "@/utils/_util";

const TOGETHER_MODELS_URL = "https://api.together.xyz/v1/models";

export class TogetherModelsError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "TogetherModelsError";
  }
}

interface TogetherModelApiItem {
  id?: unknown;
  type?: unknown;
  display_name?: unknown;
  context_length?: unknown;
}

export function normalizeTogetherChatModels(input: unknown): AiModelOption[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((item): item is TogetherModelApiItem => {
      return Boolean(
        item &&
          typeof item === "object" &&
          (item as TogetherModelApiItem).type === "chat" &&
          typeof (item as TogetherModelApiItem).id === "string" &&
          !_util.isNullOrWhitespace((item as TogetherModelApiItem).id as string)
      );
    })
    .map((item) => {
      const displayName = typeof item.display_name === "string"
        ? _util.toInputString(item.display_name)
        : "";
      const contextLength = typeof item.context_length === "number"
        ? item.context_length
        : null;

      return {
        id: item.id as string,
        label: displayName || (item.id as string),
        contextLength,
      };
    });
}

async function readErrorText(response: Response) {
  try {
    const body = await response.json();
    const message = body?.error?.message || body?.message;
    return typeof message === "string" ? message : "";
  } catch {
    try {
      return await response.text();
    } catch {
      return "";
    }
  }
}

export async function fetchTogetherChatModels(
  apiKey: string,
  fetchImpl: typeof fetch = fetch
): Promise<AiModelOption[]> {
  const normalizedApiKey = _util.toInputString(apiKey);
  if (!normalizedApiKey) {
    throw new TogetherModelsError("Together API key is required to load models.", 400);
  }

  const response = await fetchImpl(TOGETHER_MODELS_URL, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${normalizedApiKey}`,
    },
  });

  if (!response.ok) {
    const upstreamMessage = await readErrorText(response);
    const message = response.status === 401
      ? "Together AI authentication failed."
      : `Together AI model request failed${upstreamMessage ? `: ${upstreamMessage}` : "."}`;
    const status = response.status === 401 ? 401 : 502;
    throw new TogetherModelsError(message, status);
  }

  const data = await response.json();
  return normalizeTogetherChatModels(data);
}
