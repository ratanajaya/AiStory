import { Mistral } from "@mistralai/mistralai";
import { MistralCore } from "@mistralai/mistralai/core.js";
import { chatStream } from "@mistralai/mistralai/funcs/chatStream.js";
import Together from "together-ai";
import { getUserSettingWithFallback } from "@/auth";

export interface AiEndpoint {
  chatCompletion: (systemMsg: string | null, userMsg: string) => Promise<string>;
  chatCompletionFull: (systemMsg: string | null, messages: any[]) => Promise<string>;
  chatStream: (systemMsg: string | null, userMsg: string, onReceiveChunk: (content: string) => void) => Promise<void>;
  chatStreamFull: (systemMsg: string | null, messages: any[], onReceiveChunk: (content: string) => void) => Promise<void>;
}

const createMistralEndpoint = (model: string, apiKey: string): AiEndpoint => ({
  chatCompletionFull: async (systemMsg: string | null, messages: any[]) => {
    try {
      const mistral = new Mistral({
        apiKey,
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
    return createMistralEndpoint(model, apiKey).chatCompletionFull(systemMsg, [
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
        apiKey,
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


const createTogetherEndpoint = (model: string, apiKey: string): AiEndpoint => ({
  chatCompletionFull: async (systemMsg: string | null, messages: any[]) => {
    try {
      const together = new Together({
        apiKey,
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
    return createTogetherEndpoint(model, apiKey).chatCompletionFull(systemMsg, [
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
        apiKey,
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

// Get the endpoint based on current user configuration
export const getDynamicAiEndpoint = async (): Promise<AiEndpoint> => {
  const { selectedLlm, apiKey } = await getUserSettingWithFallback();
  
  if (selectedLlm.service === 'mistral') {
    if (!apiKey.mistral) {
      throw new Error('Mistral API key is not configured');
    }
    return createMistralEndpoint(selectedLlm.model, apiKey.mistral);
  } else if (selectedLlm.service === 'together') {
    if (!apiKey.together) {
      throw new Error('Together API key is not configured');
    }
    return createTogetherEndpoint(selectedLlm.model, apiKey.together);
  }

  throw new Error('Unsupported LLM service configured');
};
