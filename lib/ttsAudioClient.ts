import { TTS_CACHE_CONFIG_ID } from "@/lib/ttsConfig";
import {
  deleteSegmentAudio,
  getSegmentAudio,
  isSegmentAudioRecordCurrent,
  saveSegmentAudio,
} from "@/lib/ttsIndexedDb";

export const formatAudioTime = (seconds: number) => {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export const ensureSegmentAudioBlob = async (segmentId: string, content: string): Promise<Blob> => {
  const cachedAudio = await getSegmentAudio(segmentId);

  if (isSegmentAudioRecordCurrent(cachedAudio, content)) {
    return cachedAudio.audioBlob;
  }

  if (cachedAudio) {
    await deleteSegmentAudio(segmentId);
  }

  const response = await fetch('/api/ai/tts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: content,
    }),
  });

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

  return audioBlob;
};