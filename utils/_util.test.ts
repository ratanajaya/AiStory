import type { SegmentSummary, StorySegment } from "@/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import _constant from "./_constant";
import _util from "./_util";

const makeSegment = (overrides: Partial<StorySegment> = {}): StorySegment => ({
  id: "segment-1",
  day: 1,
  role: "assistant",
  content: "Segment content",
  ...overrides,
});

describe("_util", () => {
  describe("isNullOrWhitespace", () => {
    it("returns true for null, undefined, and whitespace-only strings", () => {
      expect(_util.isNullOrWhitespace(null)).toBe(true);
      expect(_util.isNullOrWhitespace(undefined)).toBe(true);
      expect(_util.isNullOrWhitespace("   ")).toBe(true);
    });

    it("returns false for non-empty text", () => {
      expect(_util.isNullOrWhitespace("story")).toBe(false);
    });
  });

  describe("altString", () => {
    it("returns the fallback when the input is blank", () => {
      expect(_util.altString("", "fallback")).toBe("fallback");
      expect(_util.altString("   ", "fallback")).toBe("fallback");
    });

    it("returns the original input when it contains text", () => {
      expect(_util.altString("chapter one", "fallback")).toBe("chapter one");
    });
  });

  describe("conditionalString", () => {
    it("returns an empty string when the input is blank", () => {
      expect(_util.conditionalString("", "visible")).toBe("");
      expect(_util.conditionalString(undefined, "visible")).toBe("");
    });

    it("returns the provided output when the input contains text", () => {
      expect(_util.conditionalString("present", "visible")).toBe("visible");
    });
  });

  describe("generateTimestamp", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 3, 25, 13, 7, 9));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("formats the current local date as YYYYMMDD-HHMMSS", () => {
      expect(_util.generateTimestamp()).toBe("20260425-130709");
    });
  });

  describe("cleanupLlmResponse", () => {
    it("removes no-content markers, markdown fences, and surrounding whitespace", () => {
      const input = "  [NO CONTENT]```json\n{\"ok\": true}\n```  ";

      expect(_util.cleanupLlmResponse(input)).toBe('{"ok": true}');
    });
  });

  describe("getStorySegmentAsString", () => {
    it("joins assistant content before the exclusive limit using summaries once", () => {
      const storySegments: StorySegment[] = [
        makeSegment({ id: "seg-1", content: "Opening" }),
        makeSegment({ id: "seg-2", role: "user", content: "Ignored user input" }),
        makeSegment({ id: "seg-3", content: "Raw content replaced by summary", segmentSummaryId: "sum-1" }),
        makeSegment({ id: "seg-4", content: "Second segment with same summary", segmentSummaryId: "sum-1" }),
        makeSegment({ id: "seg-5", content: "Excluded segment", excludeFromPrevStory: true }),
        makeSegment({ id: "seg-6", content: "Not included because of limit" }),
      ];
      const segmentSummaries: SegmentSummary[] = [
        { id: "sum-1", content: "Summary content" },
      ];

      const result = _util.getStorySegmentAsString(storySegments, segmentSummaries, "seg-6");

      expect(result).toBe(["Opening", "Summary content"].join(_constant.newLine2));
    });

    it("falls back to raw content when no summaries are provided", () => {
      const storySegments: StorySegment[] = [
        makeSegment({ id: "seg-1", content: "Segment one", segmentSummaryId: "sum-1" }),
      ];

      const result = _util.getStorySegmentAsString(storySegments, null, null);

      expect(result).toBe("Segment one");
    });

    it("includes excluded assistant segments when forceAllSegment is true", () => {
      const storySegments: StorySegment[] = [
        makeSegment({ id: "seg-1", content: "Included" }),
        makeSegment({ id: "seg-2", content: "Forced back in", excludeFromPrevStory: true }),
      ];

      const result = _util.getStorySegmentAsString(storySegments, null, null, " | ", true);

      expect(result).toBe("Included | Forced back in");
    });

    it("reports missing summaries explicitly", () => {
      const storySegments: StorySegment[] = [
        makeSegment({ id: "seg-1", segmentSummaryId: "missing-id" }),
      ];

      const result = _util.getStorySegmentAsString(storySegments, [], null);

      expect(result).toBe("[Missing summary with id missing-id]");
    });
  });

  describe("splitSegmentsWithChapter", () => {
    it("separates chapter-tagged segments from uncategorized ones", () => {
      const storySegments: StorySegment[] = [
        makeSegment({ id: "seg-1", chapterId: "chapter-1" }),
        makeSegment({ id: "seg-2" }),
      ];

      const result = _util.splitSegmentsWithChapter(storySegments);

      expect(result).toEqual({
        segmentsWithoutChapter: [storySegments[1]],
        segmentsWithChapter: [storySegments[0]],
      });
    });
  });
});