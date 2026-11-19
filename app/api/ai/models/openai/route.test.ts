import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getUserSettingWithFallback: vi.fn(),
  fetchOpenAiTextModels: vi.fn(),
  defaults: vi.fn(),
}));

vi.mock('@/lib/guest', () => ({ getActor: async () => {
  const session = await mocks.auth();
  return session?.user?.email ? { kind: 'user', ownerEmail: session.user.email, isAdmin: Boolean(session.user.isAdmin) } : null;
}, guestSettings: vi.fn() }));
vi.mock('@/models', () => ({ KeyValueModel: { findOne: () => ({ lean: mocks.defaults }) } }));
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

  it('uses the default settings key only when the request is authorized for that scope', async () => {
    const request = () => new Request('http://localhost/api/ai/models/openai', {
      method: 'POST', body: JSON.stringify({ scope: 'defaults' }),
    });
    expect((await POST(request())).status).toBe(403);
    expect(mocks.defaults).not.toHaveBeenCalled();
    mocks.auth.mockResolvedValue({ user: { email: 'admin@example.com', isAdmin: true } });
    mocks.defaults.mockResolvedValue({ value: { apiKey: { openAi: 'default-key' } } });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.fetchOpenAiTextModels).toHaveBeenCalledWith('default-key');
    expect(mocks.getUserSettingWithFallback).not.toHaveBeenCalled();
  });
});
