import { createMistral } from '@ai-sdk/mistral';
import { createOpenAI } from '@ai-sdk/openai';
import { createTogetherAI } from '@ai-sdk/togetherai';
import { generateText, streamText, ModelMessage, LanguageModel } from 'ai';
import { getUserSettingWithFallback } from "@/auth";

export interface AiEndpoint {
  chatCompletion: (systemMsg: string | null, userMsg: string) => Promise<string>;
  chatCompletionFull: (systemMsg: string | null, messages: any[]) => Promise<string>;
  chatStream: (systemMsg: string | null, userMsg: string, onReceiveChunk: (content: string) => void) => Promise<void>;
  chatStreamFull: (systemMsg: string | null, messages: any[], onReceiveChunk: (content: string) => void) => Promise<void>;
}

const createAiSdkEndpoint = (model: LanguageModel): AiEndpoint => ({
  chatCompletionFull: async (systemMsg: string | null, messages: any[]) => {
    try {
      const systemPrompt: ModelMessage[] = systemMsg ? [{ role: 'system', content: systemMsg }] : [];
      
      const { text } = await generateText({
        model,
        messages: [
          ...systemPrompt,
          ...messages,
        ] as ModelMessage[],
      });

      return text;
    } catch (error) {
       console.error('Error getting chat completion:', error);
       return 'Error: Failed to get response from AI service.';
    }
  },
  chatCompletion: async (systemMsg: string | null, userMsg: string) => {
    return createAiSdkEndpoint(model).chatCompletionFull(systemMsg, [
      { role: 'user', content: userMsg }
    ]);
  },
  chatStreamFull: async (systemMsg: string | null, messages: any[], onReceiveChunk: (content: string) => void) => {
    try {
        const systemPrompt: ModelMessage[] = systemMsg ? [{ role: 'system', content: systemMsg }] : [];
        const result = streamText({
            model,
            messages: [
                ...systemPrompt,
                ...messages,
            ] as ModelMessage[],
        });

        for await (const textPart of result.textStream) {
            onReceiveChunk(textPart);
        }
    } catch (error) {
        onReceiveChunk('Error: Failed to get response from AI service.');
        console.error('Error streaming chat:', error);
    }
  },
  chatStream: async (systemMsg: string | null, userMsg: string, onReceiveChunk: (content: string) => void) => {
      return createAiSdkEndpoint(model).chatStreamFull(
          systemMsg,
          [{ role: 'user', content: userMsg }],
          onReceiveChunk
      );
  }
});

// Get the endpoint based on current user configuration
export const getDynamicAiEndpoint = async (): Promise<AiEndpoint> => {
  const { selectedLlm, apiKey } = await getUserSettingWithFallback();
  
  if (selectedLlm.service === 'mistral') {
    if (!apiKey.mistral) {
      throw new Error('Mistral API key is not configured');
    }
    const mistral = createMistral({ apiKey: apiKey.mistral });
    return createAiSdkEndpoint(mistral(selectedLlm.model));
  } else if (selectedLlm.service === 'together') {
    if (!apiKey.together) {
      throw new Error('Together API key is not configured');
    }
    const together = createTogetherAI({ apiKey: apiKey.together });
    return createAiSdkEndpoint(together(selectedLlm.model));
  } else if (selectedLlm.service === 'openAi') {
    if (!apiKey.openAi) {
      throw new Error('OpenAI API key is not configured');
    }
    const openai = createOpenAI({ apiKey: apiKey.openAi });
    return createAiSdkEndpoint(openai(selectedLlm.model));
  }

  throw new Error('Unsupported LLM service configured');
};
