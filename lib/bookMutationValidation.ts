import { Chapter, SegmentSummary, StorySegment } from '@/types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

export function parseStorySegment(value: unknown): StorySegment | null {
  if (!isRecord(value)
    || !isNonEmptyString(value.id)
    || typeof value.day !== 'number'
    || !Number.isFinite(value.day)
    || !isNonEmptyString(value.role)
    || typeof value.content !== 'string') {
    return null;
  }

  if ((value.excludeFromPrevStory !== undefined && typeof value.excludeFromPrevStory !== 'boolean')
    || (value.toSummarize !== undefined && typeof value.toSummarize !== 'boolean')
    || (value.segmentSummaryId !== undefined && !isNonEmptyString(value.segmentSummaryId))
    || (value.chapterId !== undefined && !isNonEmptyString(value.chapterId))) {
    return null;
  }

  return {
    id: value.id,
    day: value.day,
    role: value.role,
    content: value.content,
    ...(value.excludeFromPrevStory !== undefined && { excludeFromPrevStory: value.excludeFromPrevStory }),
    ...(value.toSummarize !== undefined && { toSummarize: value.toSummarize }),
    ...(value.segmentSummaryId !== undefined && { segmentSummaryId: value.segmentSummaryId }),
    ...(value.chapterId !== undefined && { chapterId: value.chapterId }),
  };
}

export function parseSegmentSummary(value: unknown): SegmentSummary | null {
  if (!isRecord(value) || !isNonEmptyString(value.id) || typeof value.content !== 'string') {
    return null;
  }

  return { id: value.id, content: value.content };
}

export function parseChapter(value: unknown): Chapter | null {
  if (!isRecord(value)
    || !isNonEmptyString(value.id)
    || !isNonEmptyString(value.title)
    || !isNonEmptyString(value.summary)) {
    return null;
  }

  return { id: value.id, title: value.title, summary: value.summary };
}

export function parseSegmentIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0 || !value.every(isNonEmptyString)) {
    return null;
  }

  const ids = [...new Set(value)];
  return ids.length === value.length ? ids : null;
}
