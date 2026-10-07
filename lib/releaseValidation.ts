import { createHash } from 'node:crypto';
import { splitTtsText } from '@/lib/ttsChunks';
import type { ReleasedSegment, ReleaseFileInput } from '@/lib/releaseTypes';
import type { Book } from '@/types';
import _util from '@/utils/_util';
export const RELEASE_MAX_BYTES = 100 * 1024 * 1024;
export function releaseSnapshot(book: Pick<Book, 'name' | 'storySegments'>) {
  const title = _util.toInputString(book.name).trim() || 'Untitled';
  const segments: ReleasedSegment[] = book.storySegments.filter(s => s.role === 'assistant' && s.content.trim()).map(s => ({ id: s.id, content: s.content, expectedAudioParts: splitTtsText(s.content).length, audio: [] }));
  const fingerprint = createHash('sha256').update(JSON.stringify({ title, segments })).digest('hex');
  return { title, segments, fingerprint };
}
export function parseReleaseFiles(body: unknown, segments: ReleasedSegment[]): ReleaseFileInput[] | null {
  if (!body || typeof body !== 'object' || !('files' in body) || !Array.isArray(body.files) || body.files.length > 10000) return null;
  const files: ReleaseFileInput[] = []; const keys = new Set<string>(); const whole = new Map<string, boolean>(); let total = 0;
  for (const raw of body.files) {
    if (!raw || typeof raw !== 'object') return null;
    const { segmentId, partIndex, whole: isWhole, mimeType, byteSize } = raw;
    const segment = segments.find(s => s.id === segmentId);
    if (!segment || !Number.isInteger(partIndex) || partIndex < 0 || typeof isWhole !== 'boolean'
      || partIndex >= (isWhole ? 1 : segment.expectedAudioParts) || !['audio/mpeg', 'audio/wav'].includes(mimeType)
      || !Number.isSafeInteger(byteSize) || byteSize <= 0) return null;
    const key = `${segmentId}:${partIndex}`;
    if (keys.has(key) || (whole.has(segmentId) && whole.get(segmentId) !== isWhole)) return null;
    keys.add(key); whole.set(segmentId, isWhole); total += byteSize;
    if (total > RELEASE_MAX_BYTES) return null;
    files.push({ segmentId, partIndex, whole: isWhole, mimeType, byteSize });
  }
  return files;
}
export function parseAudioRange(header: string | null, size: number): { start: number; end: number } | null | false {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) return false;
  const suffix = Number(match[2]);
  const start = match[1] ? Number(match[1]) : Math.max(0, size - suffix);
  const end = match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start || (!match[1] && suffix <= 0)) return false;
  return { start, end };
}
