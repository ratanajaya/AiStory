import { createOpenAI } from '@ai-sdk/openai';
import { createTogetherAI } from '@ai-sdk/togetherai';
import { generateText, streamText, ModelMessage, LanguageModel } from 'ai';
import { getUserSettingWithFallback } from "@/auth";
import { assertSupportedLlmConfig } from "@/lib/llmSettings";
import type { GenerationProfile, GenerationProfileConfig } from '@/types';
import { toAiSdkGenerationOptions } from '@/lib/generationProfiles';

export interface AiEndpoint {
  chatCompletion: (systemMsg: string | null, userMsg: string, profile: GenerationProfile) => Promise<string>;
  chatCompletionFull: (systemMsg: string | null, messages: unknown[], profile: GenerationProfile) => Promise<string>;
  chatStream: (systemMsg: string | null, userMsg: string, profile: GenerationProfile, onReceiveChunk: (content: string) => void) => Promise<void>;
  chatStreamFull: (systemMsg: string | null, messages: unknown[], profile: GenerationProfile, onReceiveChunk: (content: string) => void) => Promise<void>;
}

const createAiSdkEndpoint = (model: LanguageModel): AiEndpoint => ({
  chatCompletionFull: async (systemMsg: string | null, messages: unknown[], profile: GenerationProfile) => {
    const systemPrompt: ModelMessage[] = systemMsg ? [{ role: 'system', content: systemMsg }] : [];

    const { text } = await generateText({
      model,
      messages: [
        ...systemPrompt,
        ...messages,
      ] as ModelMessage[],
      ...toAiSdkGenerationOptions(profile),
    });

    if (!text || !text.trim()) {
      throw new Error('LLM returned no content (empty response)');
    }

    return text;
  },
  chatCompletion: async (systemMsg: string | null, userMsg: string, profile: GenerationProfile) => {
    return createAiSdkEndpoint(model).chatCompletionFull(systemMsg, [
      { role: 'user', content: userMsg }
    ], profile);
  },
  chatStreamFull: async (systemMsg: string | null, messages: unknown[], profile: GenerationProfile, onReceiveChunk: (content: string) => void) => {
    const systemPrompt: ModelMessage[] = systemMsg ? [{ role: 'system', content: systemMsg }] : [];

    let streamError: unknown = null;
    const result = streamText({
      model,
      messages: [
        ...systemPrompt,
        ...messages,
      ] as ModelMessage[],
      ...toAiSdkGenerationOptions(profile),
      onError: ({ error }) => {
        streamError = error;
      },
    });

    let chunksReceived = 0;
    for await (const textPart of result.textStream) {
      chunksReceived++;
      onReceiveChunk(textPart);
    }

    if (streamError) {
      throw streamError;
    }

    if (chunksReceived === 0) {
      throw new Error('LLM returned no content (empty stream)');
    }
  },
  chatStream: async (systemMsg: string | null, userMsg: string, profile: GenerationProfile, onReceiveChunk: (content: string) => void) => {
      return createAiSdkEndpoint(model).chatStreamFull(
          systemMsg,
          [{ role: 'user', content: userMsg }],
          profile,
          onReceiveChunk
      );
  }
});

// Get the endpoint based on current user configuration
export const getDynamicAiEndpoint = async (): Promise<{
  endpoint: AiEndpoint;
  generationProfiles: GenerationProfileConfig;
}> => {
  const { selectedLlm, apiKey, generationProfiles } = await getUserSettingWithFallback();
  assertSupportedLlmConfig(selectedLlm);
  
  if (selectedLlm.service === 'together') {
    if (!apiKey.together) {
      throw new Error('Together API key is not configured');
    }
    const together = createTogetherAI({ apiKey: apiKey.together });
    return { endpoint: createAiSdkEndpoint(together(selectedLlm.model)), generationProfiles };
  } else if (selectedLlm.service === 'openAi') {
    if (!apiKey.openAi) {
      throw new Error('OpenAI API key is not configured');
    }
    const openai = createOpenAI({ apiKey: apiKey.openAi });
    return { endpoint: createAiSdkEndpoint(openai(selectedLlm.model)), generationProfiles };
  }

  throw new Error('Unsupported LLM service configured');
};
