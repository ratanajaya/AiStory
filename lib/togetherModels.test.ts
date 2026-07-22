import { describe, expect, it, vi } from "vitest";
import {
  fetchTogetherChatModels,
  normalizeTogetherChatModels,
  TogetherModelsError,
} from "./togetherModels";

describe("togetherModels", () => {
  it("filters chat models and preserves API order", () => {
    const models = normalizeTogetherChatModels([
      {
        id: "image-model",
        type: "image",
        display_name: "Image Model",
        context_length: 1024,
      },
      {
        id: "chat-a",
        type: "chat",
        display_name: "Chat A",
        context_length: 8192,
      },
      {
        id: "chat-b",
        type: "chat",
      },
      {
        id: "",
        type: "chat",
      },
    ]);

    expect(models).toEqual([
      { id: "chat-a", label: "Chat A", contextLength: 8192 },
      { id: "chat-b", label: "chat-b", contextLength: null },
    ]);
  });

  it("returns an empty list for unexpected API shapes", () => {
    expect(normalizeTogetherChatModels({ data: [] })).toEqual([]);
  });

  it("requires an API key before fetching", async () => {
    await expect(fetchTogetherChatModels(" ")).rejects.toMatchObject({
      name: "TogetherModelsError",
      status: 400,
      message: "Together API key is required to load models.",
    });
  });

  it("maps Together authentication failures", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "bad key" } }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    );

    await expect(fetchTogetherChatModels("key", fetchImpl)).rejects.toMatchObject({
      name: "TogetherModelsError",
      status: 401,
      message: "Together AI authentication failed.",
    });
  });

  it("maps non-auth upstream failures to a gateway-style error", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "rate limited" } }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      })
    );

    await expect(fetchTogetherChatModels("key", fetchImpl)).rejects.toMatchObject({
      name: "TogetherModelsError",
      status: 502,
      message: "Together AI model request failed: rate limited",
    });
  });

  it("returns normalized chat models from a successful fetch", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      Response.json([
        { id: "chat-a", type: "chat", display_name: "Chat A" },
        { id: "embed-a", type: "embedding" },
      ])
    );

    await expect(fetchTogetherChatModels("key", fetchImpl)).resolves.toEqual([
      { id: "chat-a", label: "Chat A", contextLength: null },
    ]);
    expect(fetchImpl).toHaveBeenCalledWith("https://api.together.xyz/v1/models", {
      method: "GET",
      headers: {
        Authorization: "Bearer key",
      },
    });
  });

  it("uses the custom Together error class", () => {
    const err = new TogetherModelsError("message", 502);
    expect(err.status).toBe(502);
    expect(err.name).toBe("TogetherModelsError");
  });
});
