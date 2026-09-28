import type { TtsConfig } from "@/types";

export const formatAudioTime = (seconds: number) => {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export async function requestTtsAudio(input: string, selectedTts: TtsConfig, options: { signal?: AbortSignal; scope?: 'actor' | 'defaults' } = {}) {
  const response = await fetch(`/api/ai/tts${options.scope === 'defaults' ? '?scope=defaults' : ''}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input, selectedTts }), signal: options.signal,
  });
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('aistory:usage'));
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string | { message?: string } } | null;
    const error = new Error(typeof body?.error === 'string' ? body.error : body?.error?.message || 'Failed to generate speech.');
    throw Object.assign(error, { statusCode: response.status });
  }
  const mimeType = response.headers.get('content-type') || 'audio/mpeg';
  const audioBlob = await response.blob();
  if (!audioBlob.size) throw new Error('No audio was returned.');
  return { audioBlob, mimeType, httpStatus: response.status };
}
