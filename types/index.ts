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

export interface PromptConfig {
  narrator: string | null;
  inputTag: string | null;
  summarizer: string | null;
  summarizerEndState: string | null;
}

export interface ApiKeyConfig {
  mistral: string | null;
  together: string | null;
  openAi: string | null;
}

export interface Template {
  templateId: string | null;
  name: string;
  prompt: PromptConfig;
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

export interface DefaultValue {
  prompt: PromptConfig;
  apiKey: ApiKeyConfig;
}

export type LLMService = 'mistral' | 'together';

export interface LlmConfig {
  service: LLMService;
  model: string;
}

export interface UserSetting {
  email: string;
  selectedLlmConfig: LlmConfig | null;
  apiKey: ApiKeyConfig;
}

export interface KeyValue {
  key: string;
  value: any;
}