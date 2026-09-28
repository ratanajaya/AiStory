import type { TtsPart } from '@/lib/ttsChunkClient';
import { playAudioBlob, subscribeToAudioPlayback } from '@/lib/ttsIndexedDb';

/** Subscribe before starting: short/cached media may finish before play() resolves. */
export function playTtsPart(part: TtsPart, blob: Blob, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    let started = false;
    let settled = false;
    let unsubscribe: (() => void) | undefined;
    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true; unsubscribe?.(); signal.removeEventListener('abort', abort);
      if (error) reject(error); else resolve();
    };
    const abort = () => finish(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    unsubscribe = subscribeToAudioPlayback(status => {
      if (status.chunkKey === part.key && status.activeSegmentId === part.segmentId) {
        started = true;
        if (status.state === 'error') finish(new Error(status.errorMessage ?? 'Audio playback failed.'));
      } else if (started) {
        if (status.state === 'idle' && !status.activeSegmentId) finish();
        else finish(new DOMException('Playback interrupted', 'AbortError'));
      }
    });
    if (settled) unsubscribe();
    void playAudioBlob(part.segmentId, blob, { chunkKey: part.key, partIndex: part.partIndex, partCount: part.partCount }).catch(finish);
  });
}
