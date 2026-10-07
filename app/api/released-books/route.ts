import { releaseOwner, releaseErrorResponse, NextResponse } from '@/lib/releases';
import { ReleasedBookModel } from '@/models';
import type { ReleasedSegment } from '@/lib/releaseTypes';
export async function GET(request: Request) {
  try {
    const ownerEmail = await releaseOwner(request);
    const books = await ReleasedBookModel.find({ ownerEmail }).sort({ releasedAt: -1 }).lean();
    return NextResponse.json(books.map(book => ({ releaseId: book.releaseId, title: book.title, releasedAt: book.releasedAt,
      segmentCount: book.segments.length, audioParts: book.segments.reduce((n: number, s: ReleasedSegment) => n + s.audio.length, 0),
      expectedAudioParts: book.segments.reduce((n: number, s: ReleasedSegment) => n + s.expectedAudioParts, 0) })), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return releaseErrorResponse(error); }
}
