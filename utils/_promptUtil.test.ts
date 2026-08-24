import { describe, expect, it } from "vitest";
import _promptUtil from "./_promptUtil";
import { Book, Template } from "@/types";
import _constant from "./_constant";
import { createEmptyLongTermMemoryState } from "@/lib/bookMemory";

const template: Template = {
  templateId: "template-1",
  name: "Template",
  promptBuilder: {
    narration1: null,
    narration2: null,
    narrationSystem: null,
    enhancer: null,
    enhancerSystem: null,
    segmentSummarizer: null,
    segmentSummarizerSystem: null,
    chapterSummarizer: null,
    chapterSummarizerSystem: null,
    outlineIdeaGenerator: null,
    outlineIdeaGeneratorSystem: null,
  },
  storyBackground: "A storm is coming.",
  writingStyle: "Use close third-person narration.",
  imageUrl: null,
  ownerEmail: "owner@example.com",
};

const book: Book = {
  bookId: "book-1",
  name: "Book",
  templateId: "template-1",
  storySegments: [
    {
      id: "seg-chapter",
      day: 0,
      role: "assistant",
      content: "This belongs to a completed chapter.",
      chapterId: "chapter-1",
    },
    {
      id: "seg-user",
      day: 0,
      role: "user",
      content: "This user input should not be part of currentChapter.",
    },
    {
      id: "seg-current",
      day: 0,
      role: "assistant",
      content: "This content should be replaced by its summary.",
      segmentSummaryId: "summary-1",
    },
    {
      id: "seg-future",
      day: 0,
      role: "assistant",
      content: "This should be excluded by the id limit.",
    },
  ],
  segmentSummaries: [
    {
      id: "summary-1",
      content: "Summarized current scene",
    },
  ],
  chapters: [
    {
      id: "chapter-1",
      title: "Prologue",
      summary: "The hero wakes.",
    },
  ],
  longTermMemory: createEmptyLongTermMemoryState(),
  ownerEmail: "owner@example.com",
};

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

describe("_promptUtil.craftBookPrompt", () => {
  it("builds background, previous chapters, and current chapter content", () => {
    const promptBuilderText = [
      "STORY BACKGROUND:",
      "",
      "{background}",
      "",
      "---",
      "",
      "PREVIOUS CHAPTERS:",
      "",
      "{previousChapters}",
      "---",
      "",
      "STORY SO FAR OF CURRENT CHAPTER:",
      "",
      "{currentChapter}",
    ].join("\n");

    const result = _promptUtil.craftBookPrompt(promptBuilderText, template, book, "seg-future", true);

    expect(result).toContain("A storm is coming.");
    expect(result).toContain("PROLOGUE:\nThe hero wakes.\n\n");
    expect(result).toContain("Summarized current scene\n\n");
    expect(result).not.toContain("This user input should not be part of currentChapter.");
    expect(result).not.toContain("This belongs to a completed chapter.");
    expect(result).not.toContain("This should be excluded by the id limit.");
  });

  it("uses the new chapter fallback when there is no assistant story yet", () => {
    const emptyBook: Book = {
      ...book,
      storySegments: [
        {
          id: "seg-user-only",
          day: 0,
          role: "user",
          content: "Only user input exists.",
        },
      ],
      segmentSummaries: [],
      chapters: [],
    };

    const result = _promptUtil.craftBookPrompt("{currentChapter}", template, emptyBook, null, true);

    expect(result).toBe("[THIS IS THE START OF A NEW CHAPTER]\n\n");
  });

  it("renders template-level writing style data", () => {
    const result = _promptUtil.craftBookPrompt(
      "<writing_style>{writingStyle}</writing_style>",
      template,
      book,
      null,
      true,
    );

    expect(result).toBe("<writing_style>Use close third-person narration.</writing_style>");
  });

  it("uses the hardcoded input tag placeholder", () => {
    const result = _promptUtil.craftBookPrompt("{inputTag}", template, book, null, true);

    expect(result).toBe(_constant.inputTag);
  });
});
