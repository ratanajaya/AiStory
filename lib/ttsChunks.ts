import { REQUEST_LIMITS } from '@/lib/guestLimits';

export const TTS_CHUNK_VERSION = 'paragraphs-v1';

/** Paragraphs stay independent. Only oversized paragraphs need finer boundaries. */
export function splitTtsText(input: string, limit: number = REQUEST_LIMITS.audioCharacters): string[] {
  if (limit < 2) throw new Error('Speech chunk size must be at least two characters.');
  const chunks: string[] = [];
  for (const paragraph of input.split(/\r?\n[\t ]*\r?\n(?:[\t ]*\r?\n)*/)) {
    let remaining = paragraph.trim();
    while (remaining.length > limit) {
      let end = limit;
      if (/[\uD800-\uDBFF]/.test(remaining[end - 1])) end--;
      const window = remaining.slice(0, end);
      const sentence = [...window.matchAll(/[.!?]["'”’)]*(?:\s+|$)|[。！？]["'”’)]*/gu)].at(-1);
      const whitespace = [...window.matchAll(/\s+/gu)].at(-1);
      const boundary = sentence ?? whitespace;
      if (boundary?.index !== undefined) end = boundary.index + boundary[0].length;
      const chunk = remaining.slice(0, end).trim();
      if (chunk) chunks.push(chunk);
      remaining = remaining.slice(end).trim();
    }
    if (remaining) chunks.push(remaining);
  }
  return chunks;
}
