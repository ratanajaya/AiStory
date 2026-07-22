import { describe, expect, it } from "vitest";
import {
  assertSupportedLlmConfig,
  getUnsupportedLlmMessage,
  isSupportedLlmService,
  validateLlmConfig,
} from "./llmSettings";

describe("llmSettings", () => {
  it("recognizes only supported services", () => {
    expect(isSupportedLlmService("together")).toBe(true);
    expect(isSupportedLlmService("openAi")).toBe(true);
    expect(isSupportedLlmService("mistral")).toBe(false);
  });

  it("rejects legacy Mistral settings", () => {
    const result = validateLlmConfig({ service: "mistral", model: "mistral-large" });

    expect(result).toEqual({
      ok: false,
      message: "Mistral is no longer supported; update settings to Together AI or OpenAI.",
    });
    expect(getUnsupportedLlmMessage("mistral")).toContain("Mistral is no longer supported");
  });

  it("rejects empty model values", () => {
    expect(validateLlmConfig({ service: "together", model: "   " })).toEqual({
      ok: false,
      message: "LLM model is required.",
    });
  });

  it("accepts Together and OpenAI settings", () => {
    expect(validateLlmConfig({ service: "together", model: "model-a" })).toEqual({
      ok: true,
      value: { service: "together", model: "model-a" },
    });
    expect(validateLlmConfig({ service: "openAi", model: "gpt-5-nano" })).toEqual({
      ok: true,
      value: { service: "openAi", model: "gpt-5-nano" },
    });
  });

  it("allows null settings only when requested", () => {
    expect(validateLlmConfig(null)).toEqual({
      ok: false,
      message: "LLM provider and model are required.",
    });
    expect(validateLlmConfig(null, { allowNull: true })).toEqual({
      ok: true,
      value: null,
    });
  });

  it("throws clear runtime errors for unsupported or empty settings", () => {
    expect(() =>
      assertSupportedLlmConfig({ service: "mistral" as never, model: "legacy" })
    ).toThrow("Mistral is no longer supported");
    expect(() =>
      assertSupportedLlmConfig({ service: "together", model: "" })
    ).toThrow("LLM model is not configured");
  });
});
