import { describe, expect, it } from "vitest";
import _promptUtil from "./_promptUtil";

describe("_promptUtil.replacePromptBuilderString", () => {
  it("replaces every matching placeholder occurrence", () => {
    const template = "Hello {name}. {name} found a {item}.";

    const result = _promptUtil.replacePromptBuilderString(template, {
      name: "Ari",
      item: "compass",
    });

    expect(result).toBe("Hello Ari. Ari found a compass.");
  });

  it("leaves placeholders unchanged when no matching key exists", () => {
    const template = "{greeting}, {name}!";

    const result = _promptUtil.replacePromptBuilderString(template, {
      greeting: "Welcome",
    });

    expect(result).toBe("Welcome, {name}!");
  });
});