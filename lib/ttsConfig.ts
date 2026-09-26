import type { TtsConfig } from '@/types';
import _util from '@/utils/_util';

export const DEFAULT_TTS_CONFIG: TtsConfig = { service: 'together', model: 'hexgrad/Kokoro-82M', voice: 'af_nicole' };
export const TTS_PREVIEW_TEXT = 'Welcome to AiStory. Every story begins with a little imagination.';

export function validateTtsConfig(input: unknown): { ok: true; value: TtsConfig | null } | { ok: false; message: string } {
  if (input == null) return { ok: true, value: null };
  if (typeof input !== 'object' || Array.isArray(input)) return { ok: false, message: 'Invalid TTS settings.' };
  const value = input as Record<string, unknown>;
  if (['service', 'model', 'voice'].some(key => value[key] != null && typeof value[key] !== 'string')) return { ok: false, message: 'TTS settings must contain strings.' };
  const model = _util.toIdentifierString(value.model as string | null | undefined);
  const voice = _util.toIdentifierString(value.voice as string | null | undefined);
  const service = _util.toIdentifierString(value.service as string | null | undefined);
  if (!model && !voice && !service) return { ok: true, value: null };
  if ((service !== 'together' && service !== 'openAi') || !model || !voice || model.length > 200 || voice.length > 200) {
    return { ok: false, message: 'A supported TTS provider, model, and voice are required.' };
  }
  return { ok: true, value: { service, model, voice } };
}

export function resolveTtsConfig(...inputs: unknown[]): TtsConfig {
  for (const input of inputs) {
    const result = validateTtsConfig(input);
    if (result.ok && result.value) return result.value;
  }
  return { ...DEFAULT_TTS_CONFIG };
}

export function ttsCacheConfigId(config: TtsConfig): string {
  return ['tts-v2', config.service, config.model, config.voice, config.service === 'openAi' ? 'wav|24000|pcm16' : 'mp3|48000', 'false'].join('|');
}
export const TTS_CACHE_CONFIG_ID = ttsCacheConfigId(DEFAULT_TTS_CONFIG);
