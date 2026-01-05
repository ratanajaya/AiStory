import { UserSetting } from "@/types";

async function getUserSetting(): Promise<UserSetting> {
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