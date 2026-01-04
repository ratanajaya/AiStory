import { getuid } from "process";

export type LLMService = 'mistral' | 'together';

export interface LlmConfig {
  service: LLMService;
  model: string;
}

export interface UserSetting {
  email: string;
  selectedLlmConfig: LlmConfig | null;
  apiKey: {
    mistral: string | null;
    together: string | null;
    openAi: string | null;
  }
}

async function getUserSetting() {
  // Placeholder: In a real app, fetch from database
  return {
    email: process.env.PLACEHOLDER_EMAIL!,
    selectedLlmConfig: {
      service: 'mistral',
      model: 'mistral-large-2411',
    },
    apiKey: {
      mistral: process.env.MISTRAL_API_KEY ?? null,
      together: process.env.TOGETHER_API_KEY ?? null,
      openAi: process.env.OPENAI_API_KEY ?? null,
    }
  };
}

export { getUserSetting };