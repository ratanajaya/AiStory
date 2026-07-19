import { ApiKeyConfig, LlmConfig, PromptBuilderConfig, PromptConfig } from '@/types';

const emptyPrompt: PromptConfig = {
  inputTag: '',
};

const emptyPromptBuilder: PromptBuilderConfig = {
  narration1: '',
  narration2: '',
  enhancer: '',
  segmentSummarizer: '',
  chapterSummarizer: '',
  outlineIdeaGenerator: '',
  noteInitializer: '',
  noteUpdater: '',
};

const emptyApiKey: ApiKeyConfig = {
  together: '',
  openAi: '',
};

const defaultSelectedLlm: LlmConfig = {
  service: 'together',
  model: '',
};

const _constant = {
  newLine: '\n',
  newLine2: '\n\n',
  emptyPrompt,
  emptyPromptBuilder,
  emptyApiKey,
  defaultSelectedLlm,

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
