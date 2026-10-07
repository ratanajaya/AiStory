import { Readable } from 'node:stream';
import { releaseOwner, ownedRelease, releaseErrorResponse, ReleaseError } from '@/lib/releases';
import { releaseAudioStream } from '@/lib/releaseStorage';
import { parseAudioRange } from '@/lib/releaseValidation';
export async function GET(request: Request, { params }: { params: Promise<{ releaseId: string; segmentId: string; partIndex: string }> }) {
  try {
    const owner = await releaseOwner(request); const { releaseId, segmentId, partIndex } = await params;
    const book = await ownedRelease(owner, releaseId);
    const revision = new URL(request.url).searchParams.get('revision');
    if (revision !== String(book.revision)) throw new ReleaseError('This release has changed. Refresh the viewer.', 409);
    const audio = /^\d+$/.test(partIndex) && book.segments.find(s => s.id === segmentId)?.audio.find(a => a.partIndex === Number(partIndex));
    if (!audio) throw new ReleaseError('Audio not found', 404);
    const range = parseAudioRange(request.headers.get('range'), audio.byteSize);
    const headers = new Headers({ 'Content-Type': audio.mimeType, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
    if (range === false) { headers.set('Content-Range', `bytes */${audio.byteSize}`); return new Response(null, { status: 416, headers }); }
    headers.set('Content-Length', String(range ? range.end - range.start + 1 : audio.byteSize));
    if (range) headers.set('Content-Range', `bytes ${range.start}-${range.end}/${audio.byteSize}`);
    const stream = await releaseAudioStream(audio.objectKey, range || undefined);
    return new Response(Readable.toWeb(stream) as ReadableStream, { status: range ? 206 : 200, headers });
  } catch (error) { return releaseErrorResponse(error); }
}
