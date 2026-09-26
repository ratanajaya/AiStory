import { ttsCacheConfigId } from "@/lib/ttsConfig";
import type { TtsConfig } from "@/types";
import {
  deleteSegmentAudio,
  getSegmentAudio,
  isSegmentAudioRecordCurrent,
  saveSegmentAudio,
} from "@/lib/ttsIndexedDb";
import { appendAiApiLog, createLogError } from "@/lib/aiApiLog";
import type { AiApiLogContext } from "@/types";

export const formatAudioTime = (seconds: number) => {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export const ensureSegmentAudioBlob = async (
  segmentId: string,
  content: string,
  logContext: AiApiLogContext | undefined,
  selectedTts: TtsConfig,
  signal?: AbortSignal,
): Promise<Blob> => {
  const configId = ttsCacheConfigId(selectedTts);
  signal?.throwIfAborted();
  const cachedAudio = await getSegmentAudio(segmentId);

  if (isSegmentAudioRecordCurrent(cachedAudio, content, configId)) {
    signal?.throwIfAborted();
    return cachedAudio.audioBlob;
  }

  if (cachedAudio) {
    await deleteSegmentAudio(segmentId);
  }

  const startedAt = Date.now();
  let httpStatus: number | undefined;

  try {
    const result = await requestTtsAudio(content, selectedTts, { signal });
    httpStatus = result.httpStatus;
    const { audioBlob, mimeType } = result;
    signal?.throwIfAborted();

    await saveSegmentAudio({
      segmentId,
      content,
      mimeType,
      configId,
      audioBlob,
      updatedAt: Date.now(),
    });

    if (logContext) {
      appendAiApiLog({
        kind: 'tts',
        status: 'success',
        ...logContext,
        payload: { input: content, selectedTts: { ...selectedTts } },
        response: { mimeType, byteSize: audioBlob.size },
        httpStatus,
        durationMs: Date.now() - startedAt,
        audio: { segmentId, mimeType, byteSize: audioBlob.size, configId },
      });
    }

    signal?.throwIfAborted();
    return audioBlob;
  } catch (error) {
    httpStatus = (error as { statusCode?: number }).statusCode ?? httpStatus;
    if (logContext && !signal?.aborted) {
      appendAiApiLog({
        kind: 'tts',
        status: 'error',
        ...logContext,
        payload: { input: content, selectedTts: { ...selectedTts } },
        error: createLogError(error),
        httpStatus,
        durationMs: Date.now() - startedAt,
      });
    }
    throw error;
  }
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
