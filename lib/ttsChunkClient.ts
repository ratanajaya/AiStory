import type { AiApiLogContext, TtsConfig } from '@/types';
import { ttsCacheConfigId } from '@/lib/ttsConfig';
import { splitTtsText, TTS_CHUNK_VERSION } from '@/lib/ttsChunks';
import { getChunkAudio, getSegmentAudio, saveChunkAudio, type SegmentAudioRecord } from '@/lib/ttsIndexedDb';
import { requestTtsAudio } from '@/lib/ttsAudioClient';
import { appendAiApiLog, createLogError } from '@/lib/aiApiLog';

export interface TtsSegment { id: string; content: string }
export interface TtsPart {
  key: string;
  segmentId: string;
  content: string;
  config: TtsConfig;
  configId: string;
  legacy: boolean;
  partIndex: number;
  partCount: number;
  segmentIndex: number;
  segmentCount: number;
}

async function hashText(text: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

const matches = (record: SegmentAudioRecord | null, part: Pick<TtsPart, 'segmentId' | 'content' | 'configId'>) =>
  record?.segmentId === part.segmentId && record.content === part.content && record.configId === part.configId;

export async function planTtsParts(segments: TtsSegment[], config: TtsConfig, signal: AbortSignal): Promise<TtsPart[]> {
  const parts: TtsPart[] = [];
  const configId = ttsCacheConfigId(config);
  for (const [segmentIndex, segment] of segments.entries()) {
    signal.throwIfAborted();
    const whole = await getSegmentAudio(segment.id);
    const legacy = matches(whole, { segmentId: segment.id, content: segment.content, configId });
    const texts = legacy ? [segment.content] : splitTtsText(segment.content);
    for (const [partIndex, content] of texts.entries()) {
      const key = JSON.stringify([segment.id, configId, legacy ? 'whole' : TTS_CHUNK_VERSION, await hashText(content)]);
      parts.push({ key, segmentId: segment.id, content, config: { ...config }, configId, legacy,
        partIndex, partCount: texts.length, segmentIndex, segmentCount: segments.length });
    }
  }
  signal.throwIfAborted();
  return parts;
}

async function readRecord(part: TtsPart) {
  const record = part.legacy ? await getSegmentAudio(part.segmentId) : await getChunkAudio(part.key);
  return matches(record, part) ? record : null;
}

/** Resolves after IndexedDB commits, without retaining the blob in the scheduler. */
export async function ensureTtsPart(part: TtsPart, context: AiApiLogContext, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  const record = await readRecord(part);
  signal.throwIfAborted();
  if (record) return;
  if (part.legacy) throw new Error('Cached recording is no longer available. Start playback again.');
  const startedAt = Date.now();
  let httpStatus: number | undefined;
  try {
    const result = await requestTtsAudio(part.content, part.config, { signal });
    httpStatus = result.httpStatus;
    signal.throwIfAborted();
    await saveChunkAudio({ cacheKey: part.key, chunkVersion: TTS_CHUNK_VERSION,
      segmentId: part.segmentId, content: part.content, configId: part.configId,
      audioBlob: result.audioBlob, mimeType: result.mimeType, updatedAt: Date.now() }, signal);
    signal.throwIfAborted();
    appendAiApiLog({ ...context, kind: 'tts', status: 'success', httpStatus, durationMs: Date.now() - startedAt,
      payload: { input: part.content, selectedTts: { ...part.config } },
      response: { mimeType: result.mimeType, byteSize: result.audioBlob.size },
      audio: { cacheKey: part.key, segmentId: part.segmentId, configId: part.configId,
        partIndex: part.partIndex, partCount: part.partCount, mimeType: result.mimeType, byteSize: result.audioBlob.size } });
  } catch (error) {
    if (!signal.aborted) appendAiApiLog({ ...context, kind: 'tts', status: 'error',
      httpStatus: (error as { statusCode?: number }).statusCode ?? httpStatus, durationMs: Date.now() - startedAt,
      payload: { input: part.content, selectedTts: { ...part.config } }, error: createLogError(error) });
    throw error;
  }
}

export async function readTtsPart(part: TtsPart): Promise<Blob> {
  const record = await readRecord(part);
  if (!record) throw new Error('Cached audio is no longer available. Start playback again.');
  return record.audioBlob;
}
