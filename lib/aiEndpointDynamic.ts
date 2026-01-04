import { Mistral } from "@mistralai/mistralai";
import { MistralCore } from "@mistralai/mistralai/core.js";
import { chatStream } from "@mistralai/mistralai/funcs/chatStream.js";
import Together from "together-ai";
import { LlmConfig, UserSetting } from "./userSetting";

export interface AiEndpoint {
  chatCompletion: (systemMsg: string | null, userMsg: string) => Promise<string>;
  chatCompletionFull: (systemMsg: string | null, messages: any[]) => Promise<string>;
  chatStream: (systemMsg: string | null, userMsg: string, onReceiveChunk: (content: string) => void) => Promise<void>;
  chatStreamFull: (systemMsg: string | null, messages: any[], onReceiveChunk: (content: string) => void) => Promise<void>;
}

const placeholderUserSetting: UserSetting = {
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

console.log('Using LLM config:', placeholderUserSetting.selectedLlmConfig);
// Create Mistral endpoint with specific model
const createMistralEndpoint = (model: string): AiEndpoint => ({
  chatCompletionFull: async (systemMsg: string | null, messages: any[]) => {
    try {
      const mistral = new Mistral({
        apiKey: placeholderUserSetting.apiKey.mistral!,
      });
      
      const systemPropmt = systemMsg ?
      [
        {
          role: "system",
          content: systemMsg,
        }
      ] : [];

      const result = await mistral.chat.complete({
        model,
        stream: false,
        messages: [
          ...systemPropmt,
          ...messages,
        ],
      });

      return result?.choices?.[0]?.message?.content as string;
    } catch (error) {
      console.error('Error getting chat completion from Mistral API:', error);
      return 'Error: Failed to get response from Mistral AI service.';
    }
  },
  chatCompletion: async (systemMsg: string | null, userMsg: string) => {
    return createMistralEndpoint(model).chatCompletionFull(systemMsg, [
      {
        role: 'user',
        content: userMsg,
      },
    ]);
  },
  chatStreamFull: async function(
    systemMsg: string | null, 
    messages: any[], 
    onReceiveChunk: (content: string) => void,
  ) {
    try {
      const mistral = new MistralCore({
        apiKey: placeholderUserSetting.apiKey.mistral!,
      });
      
      const systemPropmt = systemMsg ?
        [
          {
            role: "system",
            content: systemMsg,
          }
        ] : [];
  
      const res = await chatStream(mistral, {
        model,
        stream: true,
        messages: [
          ...systemPropmt,
          ...messages,
        ],
      });

      if (!res.ok) {
        throw res.error;
      }
    
      const { value: result } = res;
    
      for await (const event of result) {
        onReceiveChunk(event?.data?.choices?.[0]?.delta?.content as string ?? '[NO CONTENT]');
      }
    } catch (error) {
      onReceiveChunk('Error: Failed to get response from Mistral AI service.');
      console.error('Error streaming chat from Mistral API:', error);
    }
  },
  chatStream: async function(
    systemMsg: string | null, 
    userMsg: string, 
    onReceiveChunk: (content: string) => void,
  ) {
    return this.chatStreamFull(
      systemMsg,
      [
        {
          content: userMsg,
          role: "user",
        }
      ],
      onReceiveChunk
    );
  },
});

// Create Together endpoint with specific model
const createTogetherEndpoint = (model: string): AiEndpoint => ({
  chatCompletionFull: async (systemMsg: string | null, messages: any[]) => {
    try {
      const together = new Together({
        apiKey: placeholderUserSetting.apiKey.together!,
      });
      
      const systemPropmt = systemMsg ?
      [
        {
          role: "system",
          content: systemMsg,
        }
      ] : [];

      const result = await together.chat.completions.create({
        model,
        stream: false,
        messages: [
          ...systemPropmt,
          ...messages,
        ],
      });

      return result?.choices?.[0]?.message?.content as string;
    } catch (error) {
      console.error('Error getting chat completion from Together API:', error);
      return 'Error: Failed to get response from Together AI service.';
    }
  },
  chatCompletion: async (systemMsg: string | null, userMsg: string) => {
    return createTogetherEndpoint(model).chatCompletionFull(systemMsg, [
      {
        role: 'user',
        content: userMsg,
      },
    ]);
  },
  chatStreamFull: async function(
    systemMsg: string | null, 
    messages: any[], 
    onReceiveChunk: (content: string) => void,
  ) {
    try {
      const together = new Together({
        apiKey: placeholderUserSetting.apiKey.together!,
      });
      
      const systemPropmt = systemMsg ?
      [
        {
          role: "system",
          content: systemMsg,
        }
      ] : [];
  
      const stream = await together.chat.completions.create({
        stream: true,
        model,
        messages: [
          ...systemPropmt,
          ...messages,
        ],
      });

      for await (const chunk of stream) {
        onReceiveChunk(chunk.choices[0]?.delta?.content ?? '[NO CONTENT]');
      }
    } catch (error) {
      onReceiveChunk('Error: Failed to get response from Together AI service.');
      console.error('Error streaming chat from Together API:', error);
    }
  },
  chatStream: async function(
    systemMsg: string | null, 
    userMsg: string, 
    onReceiveChunk: (content: string) => void,
  ) {
    return this.chatStreamFull(
      systemMsg,
      [
        {
          content: userMsg,
          role: "user",
        }
      ],
      onReceiveChunk
    );
  }
});

// Get the endpoint based on current configuration
export const getDynamicAiEndpoint = (): AiEndpoint => {    
  if (placeholderUserSetting.selectedLlmConfig?.service === 'mistral') {
    return createMistralEndpoint(placeholderUserSetting.selectedLlmConfig.model);
  } else if (placeholderUserSetting.selectedLlmConfig?.service === 'together') {
    return createTogetherEndpoint(placeholderUserSetting.selectedLlmConfig.model);
  }
  
  // Fallback to default
  console.warn('Unknown service, falling back to default Mistral');
  return createMistralEndpoint('mistral-large-latest');
};

const aiEndpointDynamic = getDynamicAiEndpoint();

export default aiEndpointDynamic;
