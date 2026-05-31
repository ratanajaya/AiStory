import { ApiKeyConfig, LlmConfig, PromptBuilderConfig, PromptConfig } from '@/types';

const emptyPrompt: PromptConfig = {
  narrator: '',
  inputTag: '',
  summarizer: '',
  summarizerEndState: '',
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
  mistral: '',
  together: '',
  openAi: '',
};

const defaultSelectedLlm: LlmConfig = {
  service: 'mistral',
  model: 'mistral-large-2512',
};

const _constant = {
  newLine: '\n',
  newLine2: '\n\n',
  emptyPrompt,
  emptyPromptBuilder,
  emptyApiKey,
  defaultSelectedLlm,

  llmServices: {
    mistral: {
      label: 'Mistral AI',
      provider: 'mistral',
      models: [
        'mistral-large-2512',
        'mistral-large-latest',
      ],
    },
    together: {
      label: 'Together AI',
      provider: 'together',
      models: [
        'deepseek-ai/DeepSeek-V4-Pro',
        'MiniMaxAI/MiniMax-M2.7',
        'moonshotai/Kimi-K2.6',
        'zai-org/GLM-5',
        'zai-org/GLM-5.1',
      ],
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