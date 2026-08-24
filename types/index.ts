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

export type JsonValue = string | number | boolean | null | JsonValue[] | {
  [key: string]: JsonValue;
};

export interface LongTermMemoryEntry {
  category: string;
  title: string;
  attributes: Record<string, JsonValue>;
}

export interface LongTermMemoryContent {
  schemaVersion: 1;
  entries: Record<string, LongTermMemoryEntry>;
}

export interface LongTermMemoryCheckpoint {
  throughSegmentId: string | null;
  fingerprint: string | null;
}

export interface LongTermMemoryState {
  content: LongTermMemoryContent;
  revision: number;
  checkpoint: LongTermMemoryCheckpoint;
  updatedAt: string | null;
}

export type MemoryPatchOperation =
  | { op: 'add' | 'replace'; path: string; value: JsonValue }
  | { op: 'remove'; path: string };

export type MemoryProposalMode = 'incremental' | 'full';

export interface MemoryProposalSource {
  mode: MemoryProposalMode;
  previousThroughSegmentId: string | null;
  throughSegmentId: string;
  fingerprint: string;
}

export interface LongTermMemoryProposal {
  baseRevision: number;
  operations: MemoryPatchOperation[];
  source: MemoryProposalSource;
}

export interface DebugLog {
  id: string;
  type: 'info' | 'error' | 'warning';
  content: string;
}

export interface PromptBuilderConfig {
  narration1: string | null;
  narration2: string | null;
  narrationSystem: string | null;
  enhancer: string | null;
  enhancerSystem: string | null;
  segmentSummarizer: string | null;
  segmentSummarizerSystem: string | null;
  chapterSummarizer: string | null;
  chapterSummarizerSystem: string | null;
  outlineIdeaGenerator: string | null;
  outlineIdeaGeneratorSystem: string | null;
}

export interface ApiKeyConfig {
  together: string | null;
  openAi: string | null;
}

export interface Template {
  templateId: string | null;
  name: string;
  promptBuilder: PromptBuilderConfig;
  storyBackground: string;
  writingStyle: string;
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
  longTermMemory: LongTermMemoryState;
  ownerEmail: string;
}

export interface DefaultValue {
  promptBuilder: PromptBuilderConfig;
  generationProfiles: GenerationProfileConfig;
  selectedLlm: LlmConfig;
  apiKey: ApiKeyConfig;
}

export type AiGenerationFeature =
  | 'default'
  | 'narration'
  | 'outlineIdeaGenerator'
  | 'enhancer'
  | 'segmentSummarizer'
  | 'chapterSummarizer'
  | 'longTermMemory';

export interface GenerationProfile {
  temperature: number | null;
  maxOutputTokens: number;
  timeoutMs: number;
  maxRetries: number;
}

export type GenerationProfileConfig = Record<AiGenerationFeature, GenerationProfile>;

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

export type JsonLogValue = JsonValue;

export interface AiApiLogContext {
  feature: string;
  bookId?: string;
  bookName?: string | null;
}

export interface AiApiLogAudioReference {
  segmentId: string;
  mimeType: string;
  byteSize: number;
  configId: string;
}

export interface AiApiLogEntry {
  id: string;
  createdAt: number;
  kind: 'llm' | 'tts';
  status: 'success' | 'error';
  feature: string;
  bookId?: string;
  bookName?: string | null;
  payload: JsonLogValue;
  response?: JsonLogValue;
  error?: JsonLogValue;
  httpStatus?: number;
  durationMs: number;
  audio?: AiApiLogAudioReference;
}
