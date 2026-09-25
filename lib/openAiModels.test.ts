import { describe, expect, it, vi } from "vitest";
import { fetchOpenAiTextModels, normalizeOpenAiTextModels } from "./openAiModels";

describe("openAiModels", () => {
  it("keeps text generation models from the OpenAI list response", () => {
    expect(normalizeOpenAiTextModels({ data: [
      { id: "gpt-6-luna", object: "model" },
      { id: "o3-mini", object: "model" },
      { id: "ft:gpt-4o-mini:org:custom:id", object: "model" },
      { id: "gpt-image-1", object: "model" },
      { id: "gpt-4o-realtime-preview", object: "model" },
      { id: "text-embedding-3-small", object: "model" },
      { id: "", object: "model" },
      { id: null, object: "model" },
    ] })).toEqual([
      { id: "gpt-6-luna", label: "gpt-6-luna", contextLength: null },
      { id: "o3-mini", label: "o3-mini", contextLength: null },
      { id: "ft:gpt-4o-mini:org:custom:id", label: "ft:gpt-4o-mini:org:custom:id", contextLength: null },
    ]);
    expect(normalizeOpenAiTextModels([])).toEqual([]);
  });

  it("requires a key and hides upstream error details", async () => {
    await expect(fetchOpenAiTextModels(" ")).rejects.toMatchObject({ status: 400 });
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({ error: { message: "secret detail" } }, { status: 429 }));
    await expect(fetchOpenAiTextModels("key", fetchImpl)).rejects.toMatchObject({
      name: "OpenAiModelsError",
      status: 502,
      message: "OpenAI model request failed.",
    });
  });

  it("fetches models with a bearer token", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({ data: [{ id: "gpt-6-luna" }] }));
    await expect(fetchOpenAiTextModels("key", fetchImpl)).resolves.toEqual([
      { id: "gpt-6-luna", label: "gpt-6-luna", contextLength: null },
    ]);
    expect(fetchImpl).toHaveBeenCalledWith("https://api.openai.com/v1/models", {
      method: "GET",
      headers: { Authorization: "Bearer key" },
    });
  });
});
