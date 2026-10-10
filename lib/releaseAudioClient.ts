import { planTtsParts } from '@/lib/ttsChunkClient';
import { getChunkAudio, getSegmentAudio, isSegmentAudioRecordCurrent } from '@/lib/ttsIndexedDb';
import type { ReleaseAttemptResponse, ReleaseFileInput } from '@/lib/releaseTypes';
export async function collectReleaseAudio(attempt: ReleaseAttemptResponse, signal: AbortSignal) {
  const parts = await planTtsParts(attempt.segments, attempt.selectedTts, signal);
  const files: Array<{ manifest: ReleaseFileInput; blob: Blob }> = [];
  for (const part of parts) {
    signal.throwIfAborted();
    const record = part.legacy ? await getSegmentAudio(part.segmentId) : await getChunkAudio(part.key);
    if (!isSegmentAudioRecordCurrent(record, part.content, part.configId) || !record.audioBlob.size) continue;
    const mimeType = record.mimeType.split(';')[0].trim().toLowerCase();
    if (!['audio/mpeg', 'audio/wav'].includes(mimeType)) continue;
    files.push({ manifest: { segmentId: part.segmentId, partIndex: part.partIndex, whole: part.legacy, mimeType, byteSize: record.audioBlob.size }, blob: record.audioBlob });
  }
  const expectedParts = parts.length;
  return { files, expectedParts };
}
