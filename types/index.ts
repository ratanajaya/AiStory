export interface StorySegment {
  id: string;
  day: number;
  role: string;
  content: string;
  excludeFromPrevStory?: boolean;
  toSummarize?: boolean;
  segmentSummaryId?: string;
  chapterId?: string;
}

export interface SegmentSummary {
  id: string;
  content: string;
}

export interface Chapter {
  id: string;
  title: string;
  summary: string;
  endState: any;
}

export interface DebugLog {
  id: string;
  type: 'info' | 'error' | 'warning';
  content: string;
}

export interface Template {
  templateId: string | null;
  name: string;
  prompt: {
    narrator: string | null;
    inputTag: string | null;
    summarizer: string | null;
    summarizerEndState: string | null;
  }
  storyBackground: string;
}

export interface Book {
  bookId: string;
  name: string | null;
  templateId: string;
  storySegments: StorySegment[];
  segmentSummaries: SegmentSummary[];
  chapters: Chapter[];
}
