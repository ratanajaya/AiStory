import { StorySegment, Template } from '@/types';

type TimestampValue = string | number | Date | null | undefined;

export type HomepageTemplate = Template & {
  updatedAt?: TimestampValue;
};

export interface HomepageBook {
  bookId: string;
  name: string | null;
  templateId: string;
  updatedAt?: TimestampValue;
  storySegments?: Array<Pick<StorySegment, 'id'>>;
}

const toDateTimestamp = (value: TimestampValue): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
};

const segmentIdToTimestamp = (segmentId: string): number | null => {
  if (!/^\d+$/.test(segmentId)) {
    return null;
  }

  const timestamp = Number(segmentId);
  if (!Number.isSafeInteger(timestamp)) {
    return null;
  }

  return toDateTimestamp(timestamp);
};

const newestTimestamp = (timestamps: Array<number | null>): number | null => {
  const validTimestamps = timestamps.filter((timestamp): timestamp is number => timestamp !== null);
  return validTimestamps.length > 0 ? Math.max(...validTimestamps) : null;
};

export const getBookActivityTimestamp = (book: HomepageBook): number | null => {
  const segmentTimestamps = (book.storySegments ?? []).map((segment) => segmentIdToTimestamp(segment.id));
  return newestTimestamp([toDateTimestamp(book.updatedAt), ...segmentTimestamps]);
};

export const sortTemplatesByBookActivity = (
  templates: HomepageTemplate[],
  books: HomepageBook[],
): HomepageTemplate[] => {
  const latestBookActivityByTemplate = new Map<string, number>();

  for (const book of books) {
    const bookActivity = getBookActivityTimestamp(book);
    if (bookActivity === null) {
      continue;
    }

    const currentActivity = latestBookActivityByTemplate.get(book.templateId);
    if (currentActivity === undefined || bookActivity > currentActivity) {
      latestBookActivityByTemplate.set(book.templateId, bookActivity);
    }
  }

  return templates
    .map((template, index) => ({
      template,
      index,
      activity: template.templateId
        ? latestBookActivityByTemplate.get(template.templateId) ?? toDateTimestamp(template.updatedAt)
        : toDateTimestamp(template.updatedAt),
    }))
    .sort((left, right) => {
      if (left.activity === null && right.activity === null) {
        return left.index - right.index;
      }
      if (left.activity === null) {
        return 1;
      }
      if (right.activity === null) {
        return -1;
      }
      return right.activity - left.activity || left.index - right.index;
    })
    .map(({ template }) => template);
};
