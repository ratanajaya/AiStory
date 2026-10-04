import type { StorySegment } from '@/types';
import _util from '@/utils/_util';

export interface BookStartResponse {
  bookId: string;
  starterSegmentId?: string;
}

export function createStarterSegments(outline: string | null | undefined): StorySegment[] {
  const content = _util.toIdentifierString(outline);
  return content ? [{ id: Date.now().toString(), day: 0, role: 'user', content }] : [];
}

export function bookStartUrl(result: BookStartResponse): string {
  return `/book/${result.bookId}${result.starterSegmentId ? `?starterSegmentId=${encodeURIComponent(result.starterSegmentId)}` : ''}`;
}
