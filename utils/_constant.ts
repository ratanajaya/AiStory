import { ApiKeyConfig, GenerationProfileConfig, LlmConfig, PromptBuilderConfig } from '@/types';

const emptyPromptBuilder: PromptBuilderConfig = {
  narration1: '',
  narration2: '',
  narrationSystem: '',
  enhancer: '',
  enhancerSystem: '',
  segmentSummarizer: '',
  segmentSummarizerSystem: '',
  chapterSummarizer: '',
  chapterSummarizerSystem: '',
  outlineIdeaGenerator: '',
  outlineIdeaGeneratorSystem: '',
};

const emptyApiKey: ApiKeyConfig = {
  together: '',
  openAi: '',
};

const defaultSelectedLlm: LlmConfig = {
  service: 'together',
  model: '',
};

const defaultGenerationProfiles: GenerationProfileConfig = {
  default: { temperature: null, maxOutputTokens: 600, timeoutMs: 60_000, maxRetries: 1 },
  narration: { temperature: null, maxOutputTokens: 1_200, timeoutMs: 60_000, maxRetries: 1 },
  outlineIdeaGenerator: { temperature: null, maxOutputTokens: 600, timeoutMs: 60_000, maxRetries: 1 },
  enhancer: { temperature: null, maxOutputTokens: 1_200, timeoutMs: 60_000, maxRetries: 1 },
  segmentSummarizer: { temperature: null, maxOutputTokens: 500, timeoutMs: 60_000, maxRetries: 1 },
  chapterSummarizer: { temperature: null, maxOutputTokens: 700, timeoutMs: 60_000, maxRetries: 1 },
};

const _constant = {
  newLine: '\n',
  newLine2: '\n\n',
  inputTag: 'OUTLINE:',
  emptyPromptBuilder,
  emptyApiKey,
  defaultSelectedLlm,
  defaultGenerationProfiles,

  llmServices: {
    together: {
      label: 'Together AI',
      provider: 'together',
      models: [],
    },
    openAi: {
      label: 'OpenAI',
      provider: 'openAi',
      models: [
        'gpt-5-nano',
        'gpt-4.1',
      ],
    },
  },
}

export default _constant;
