import { getUserSettingWithFallback } from "@/auth";

const TOGETHER_TTS_URL = 'https://api.together.xyz/v1/audio/speech';

export interface TtsEndpoint {
  generateAudio: (input: string) => Promise<{
    audioBuffer: ArrayBuffer;
    contentType: string;
  }>;
}

const createTogetherTtsEndpoint = (apiKey: string): TtsEndpoint => ({
  generateAudio: async (input: string) => {
    const response = await fetch(TOGETHER_TTS_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'hexgrad/Kokoro-82M',
        input,
        voice: 'af_heart',
        response_format: 'mp3',
        sample_rate: 48000,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to generate TTS audio');
    }

    const audioBuffer = await response.arrayBuffer();
    const upstreamType = response.headers.get('content-type');

    return {
      audioBuffer,
      contentType: upstreamType && upstreamType !== 'application/octet-stream'
        ? upstreamType
        : 'audio/mpeg',
    };
  },
});

export const getDynamicTtsEndpoint = async (): Promise<TtsEndpoint> => {
  const { apiKey } = await getUserSettingWithFallback();

  if (!apiKey.together) {
    throw new Error('Together API key is not configured');
  }

  return createTogetherTtsEndpoint(apiKey.together);
};