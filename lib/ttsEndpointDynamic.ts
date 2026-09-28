import type { TtsConfig } from '@/types';
import { pcmToWav } from '@/lib/ttsPcm';

export interface TtsEndpoint {
  generateAudio: (input: string) => Promise<{ audioBuffer: ArrayBuffer; contentType: string }>;
}

export function getDynamicTtsEndpoint(config: TtsConfig, apiKey: string, signal?: AbortSignal): TtsEndpoint {
  const openAi = config.service === 'openAi';
  return {
    generateAudio: async (input) => {
      const response = await fetch(openAi ? 'https://api.openai.com/v1/audio/speech' : 'https://api.together.xyz/v1/audio/speech', {
        method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: config.model, voice: config.voice, input,
          ...(openAi ? { response_format: 'pcm' } : { response_format: 'mp3', sample_rate: 48000, stream: false }) }),
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(120_000)]) : AbortSignal.timeout(120_000),
      });
      if (!response.ok) throw Object.assign(new Error('TTS provider rejected the request'), { statusCode: response.status });
      const buffer = await response.arrayBuffer();
      if (!buffer.byteLength) throw new Error('TTS provider returned empty audio');
      const upstreamType = response.headers.get('content-type');
      const contentType = upstreamType && upstreamType !== 'application/octet-stream' ? upstreamType : 'audio/mpeg';
      return openAi ? { audioBuffer: pcmToWav([buffer]), contentType: 'audio/wav' } : { audioBuffer: buffer, contentType };
    },
  };
}
