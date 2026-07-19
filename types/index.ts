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

export interface StorySegmentCandidate {
  id: string;
  userSegmentId: string;
  contents: string[];
  selectedContentIndex: number;
  isLoading: boolean;
}

export interface SegmentSummary {
  id: string;
  content: string;
}

export interface Chapter {
  id: string;
  title: string;
  summary: string;
}

export interface DebugLog {
  id: string;
  type: 'info' | 'error' | 'warning';
  content: string;
}

export interface PromptConfig {
  inputTag: string | null;
}

export interface PromptBuilderConfig {
  narration1: string | null;
  narration2: string | null;
  enhancer: string | null;
  segmentSummarizer: string | null;
  chapterSummarizer: string | null;
  outlineIdeaGenerator: string | null;
  noteInitializer: string | null;
  noteUpdater: string | null;
}

export interface ApiKeyConfig {
  together: string | null;
  openAi: string | null;
}

export interface Template {
  templateId: string | null;
  name: string;
  prompt: PromptConfig;
  promptBuilder: PromptBuilderConfig;
  storyBackground: string;
  imageUrl: string | null;
  ownerEmail: string;
}

export interface Book {
  bookId: string;
  name: string | null;
  templateId: string;
  storySegments: StorySegment[];
  segmentSummaries: SegmentSummary[];
  chapters: Chapter[];
  ownerEmail: string;
  version: number;
}

export interface DefaultValue {
  prompt: PromptConfig;
  promptBuilder: PromptBuilderConfig;
  selectedLlm: LlmConfig;
  apiKey: ApiKeyConfig;
}

export type LLMService = 'together' | 'openAi';

export interface LlmConfig {
  service: LLMService;
  model: string;
}

export interface AiModelOption {
  id: string;
  label: string;
  contextLength: number | null;
}

export interface User {
  email: string;
  isAdmin: boolean;
  registeredAt: Date;
  lastLoginAt: Date;
  selectedLlm: LlmConfig | null;
  apiKey: ApiKeyConfig;
}

export interface KeyValue {
  key: string;
  value: any;
}
