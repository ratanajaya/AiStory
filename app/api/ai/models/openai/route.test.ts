import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getUserSettingWithFallback: vi.fn(),
  fetchOpenAiTextModels: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
  getUserSettingWithFallback: mocks.getUserSettingWithFallback,
}));
vi.mock("@/lib/openAiModels", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/openAiModels")>();
  return { ...actual, fetchOpenAiTextModels: mocks.fetchOpenAiTextModels };
});

import { POST } from "./route";

describe("POST /api/ai/models/openai", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { email: "user@example.com" } });
    mocks.getUserSettingWithFallback.mockResolvedValue({ apiKey: { openAi: "saved-key" } });
    mocks.fetchOpenAiTextModels.mockResolvedValue([{ id: "gpt-6-luna", label: "gpt-6-luna", contextLength: null }]);
  });

  it("requires authentication", async () => {
    mocks.auth.mockResolvedValue(null);
    const response = await POST(new Request("http://localhost/api/ai/models/openai", { method: "POST" }));
    expect(response.status).toBe(401);
    expect(mocks.fetchOpenAiTextModels).not.toHaveBeenCalled();
  });

  it("uses an entered key before the saved fallback", async () => {
    const response = await POST(new Request("http://localhost/api/ai/models/openai", {
      method: "POST",
      body: JSON.stringify({ apiKey: "entered-key" }),
    }));
    expect(response.status).toBe(200);
    expect(mocks.fetchOpenAiTextModels).toHaveBeenCalledWith("entered-key");
    expect(mocks.getUserSettingWithFallback).not.toHaveBeenCalled();
  });

  it("uses the saved key when the request omits one", async () => {
    const response = await POST(new Request("http://localhost/api/ai/models/openai", { method: "POST" }));
    expect(response.status).toBe(200);
    expect(mocks.fetchOpenAiTextModels).toHaveBeenCalledWith("saved-key");
  });

  it("returns a clear error when no key exists", async () => {
    mocks.getUserSettingWithFallback.mockResolvedValue({ apiKey: { openAi: "" } });
    const response = await POST(new Request("http://localhost/api/ai/models/openai", { method: "POST" }));
    expect(response.status).toBe(400);
    expect(mocks.fetchOpenAiTextModels).not.toHaveBeenCalled();
  });
});
