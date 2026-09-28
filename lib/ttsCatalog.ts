import type { LLMService, TtsModelOption } from '@/types';
import _util from '@/utils/_util';

export class TtsError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

const legacyVoices = ['alloy', 'ash', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer'];
const modernVoices = [...legacyVoices, 'ballad', 'verse', 'marin', 'cedar'];
const openAiSpeechModels = new Set(['tts-1', 'tts-1-hd', 'gpt-4o-mini-tts', 'gpt-4o-mini-tts-2025-12-15']);
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const string = (value: unknown) => typeof value === 'string' ? _util.toIdentifierString(value) : '';

export function normalizeOpenAiTtsModels(input: unknown): TtsModelOption[] {
  const data = record(input).data;
  if (!Array.isArray(data)) return [];
  return [...new Set(data.map(item => string(record(item).id)))].filter(id => openAiSpeechModels.has(id)).map(id => ({
    id, label: id, defaultVoice: id.startsWith('gpt-') ? 'coral' : 'alloy',
    voices: (id.startsWith('gpt-') ? modernVoices : legacyVoices).map(id => ({ id, label: id })),
  }));
}

export function normalizeTogetherTtsModels(input: unknown): TtsModelOption[] {
  const data = Array.isArray(input) ? input : record(input).data;
  if (!Array.isArray(data)) return [];
  const models = new Map<string, TtsModelOption>();
  for (const item of data) {
    const raw = record(item);
    const id = string(raw.model);
    if (!id || !Array.isArray(raw.voices)) continue;
    const voices = new Map<string, { id: string; label: string }>();
    for (const entry of raw.voices) {
      const voice = record(entry);
      const voiceId = string(voice.id) || string(voice.name) || string(entry);
      if (voiceId) voices.set(voiceId, { id: voiceId, label: string(voice.name) || voiceId });
    }
    if (!voices.size) continue;
    const options = [...voices.values()];
    models.set(id, { id, label: string(raw.display_name) || id, voices: options,
      defaultVoice: id === 'hexgrad/Kokoro-82M' && voices.has('af_nicole') ? 'af_nicole' : options[0].id });
  }
  return [...models.values()];
}

export async function fetchTtsModels(service: LLMService, apiKey: string | null | undefined, signal?: AbortSignal): Promise<TtsModelOption[]> {
  if (!_util.toInputString(apiKey)) throw new TtsError(`${service === 'openAi' ? 'OpenAI' : 'Together AI'} API key is not configured.`);
  const response = await fetch(service === 'openAi' ? 'https://api.openai.com/v1/models' : 'https://api.together.xyz/v1/voices', {
    headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store',
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw Object.assign(new Error('TTS catalog request failed'), { statusCode: response.status });
  const data: unknown = await response.json();
  return service === 'openAi' ? normalizeOpenAiTtsModels(data) : normalizeTogetherTtsModels(data);
}
