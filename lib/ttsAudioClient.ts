import { TTS_CACHE_CONFIG_ID } from "@/lib/ttsConfig";
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
  logContext?: AiApiLogContext,
): Promise<Blob> => {
  const cachedAudio = await getSegmentAudio(segmentId);

  if (isSegmentAudioRecordCurrent(cachedAudio, content)) {
    return cachedAudio.audioBlob;
  }

  if (cachedAudio) {
    await deleteSegmentAudio(segmentId);
  }

  const startedAt = Date.now();
  let httpStatus: number | undefined;

  try {
    const response = await fetch('/api/ai/tts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: content,
    }),
    });
    httpStatus = response.status;

    if (!response.ok) {
      const contentType = response.headers.get('content-type') ?? '';

      if (contentType.includes('application/json')) {
        const errorBody = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(errorBody?.error || 'Failed to generate speech.');
      }

      const errorText = await response.text().catch(() => '');
      throw new Error(errorText || 'Failed to generate speech.');
    }

    const mimeType = response.headers.get('content-type') || 'audio/mpeg';
    const audioBlob = await response.blob();

    await saveSegmentAudio({
      segmentId,
      content,
      mimeType,
      configId: TTS_CACHE_CONFIG_ID,
      audioBlob,
      updatedAt: Date.now(),
    });

    if (logContext) {
      appendAiApiLog({
        kind: 'tts',
        status: 'success',
        ...logContext,
        payload: { input: content },
        response: { mimeType, byteSize: audioBlob.size },
        httpStatus,
        durationMs: Date.now() - startedAt,
        audio: { segmentId, mimeType, byteSize: audioBlob.size, configId: TTS_CACHE_CONFIG_ID },
      });
    }

    return audioBlob;
  } catch (error) {
    if (logContext) {
      appendAiApiLog({
        kind: 'tts',
        status: 'error',
        ...logContext,
        payload: { input: content },
        error: createLogError(error),
        httpStatus,
        durationMs: Date.now() - startedAt,
      });
    }
    throw error;
  }
};
