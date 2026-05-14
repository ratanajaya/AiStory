import type {
  ApiKeyConfig,
  PromptBuilderConfig,
  PromptConfig,
  SegmentSummary,
  StorySegment,
} from "@/types";
import _constant from "./_constant";

const _util = {
  isNullOrWhitespace: (input: string | null | undefined) => {
    return !input || !input.trim();
  },
  altString: (input: string | null | undefined, alt: string | null): string | null => {
    if(_util.isNullOrWhitespace(input)){
      return alt;
    }
    return input as string;
  },
  conditionalString: (input: string | null | undefined, output: string) => {
    if(_util.isNullOrWhitespace(input)){
      return "";
    }
    return output;
  },
  toInputString: (input: string | null | undefined): string => {
    return _util.isNullOrWhitespace(input) ? "" : (input as string);
  },
  mergeNormalizedString: (input: string | null | undefined, fallback: string | null | undefined): string => {
    return _util.toInputString(_util.altString(input, _util.toInputString(fallback)));
  },
  normalizePromptConfig: (prompt: Partial<PromptConfig> | null | undefined): PromptConfig => {
    return {
      narrator: _util.toInputString(prompt?.narrator),
      inputTag: _util.toInputString(prompt?.inputTag),
      summarizer: _util.toInputString(prompt?.summarizer),
      summarizerEndState: _util.toInputString(prompt?.summarizerEndState),
    };
  },
  normalizePromptBuilderConfig: (
    promptBuilder: Partial<PromptBuilderConfig> | null | undefined
  ): PromptBuilderConfig => {
    return {
      narration1: _util.toInputString(promptBuilder?.narration1),
      narration2: _util.toInputString(promptBuilder?.narration2),
      enhancer: _util.toInputString(promptBuilder?.enhancer),
      segmentSummarizer: _util.toInputString(promptBuilder?.segmentSummarizer),
      chapterSummarizer: _util.toInputString(promptBuilder?.chapterSummarizer),
      outlineIdeaGenerator: _util.toInputString(promptBuilder?.outlineIdeaGenerator),
      noteInitializer: _util.toInputString(promptBuilder?.noteInitializer),
      noteUpdater: _util.toInputString(promptBuilder?.noteUpdater),
    };
  },
  normalizeApiKeyConfig: (apiKey: Partial<ApiKeyConfig> | null | undefined): ApiKeyConfig => {
    return {
      mistral: _util.toInputString(apiKey?.mistral),
      together: _util.toInputString(apiKey?.together),
      openAi: _util.toInputString(apiKey?.openAi),
    };
  },
  generateTimestamp: () => {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  },

  cleanupLlmResponse: (input: string) => {
    return input.replace('[NO CONTENT]', '').replace('```json','').replace('```','').trim();
  },

  //#region Story Segment Utils
  getStorySegmentAsString: (storySegments: StorySegment[], segmentSummaries: SegmentSummary[] | null, idLimitExclusive: string | null, divider?: string, forceAllSegment?: boolean) => {
    const limitIndex = idLimitExclusive ? storySegments.findIndex(a => a.id === idLimitExclusive) : storySegments.length;

    const storySegmentToConsider = storySegments
      .filter((a, i) => a.role === 'assistant' && i < limitIndex && (forceAllSegment || a.excludeFromPrevStory !== true));

    const contentArray: string[] = [];
    const alreadyAddedSummaryIds: string[] = [];

    for (let i = 0; i < storySegmentToConsider.length; i++) {
      const seg = storySegmentToConsider[i];
      if (segmentSummaries && seg.segmentSummaryId) {
        if (!alreadyAddedSummaryIds.includes(seg.segmentSummaryId)) {
          const summary = segmentSummaries.find(s => s.id === seg.segmentSummaryId);
          alreadyAddedSummaryIds.push(seg.segmentSummaryId);
          if (summary) {
            contentArray.push(summary.content);
          }
          else { //Should never happen            
            contentArray.push(`[Missing summary with id ${seg.segmentSummaryId}]`);
          }
        }
      }
      else
        contentArray.push(seg.content);
    }

    return contentArray.join(divider ?? _constant.newLine2);
  },
  splitSegmentsWithChapter: (storySegments: StorySegment[]) => {
    const segmentsWithoutChapter: StorySegment[] = [];
    const segmentsWithChapter: StorySegment[] = [];
    storySegments.forEach(seg => {
      if (seg.chapterId) {
        segmentsWithChapter.push(seg);
      } else {
        segmentsWithoutChapter.push(seg);
      }
    });
    return { segmentsWithoutChapter, segmentsWithChapter };
  },
  //#endregion
}

export default _util;