import { releaseOwner, ownedRelease, releasedBookResponse, releaseErrorResponse, NextResponse } from '@/lib/releases';
export async function GET(request: Request, { params }: { params: Promise<{ releaseId: string }> }) {
  try { const owner = await releaseOwner(request); const { releaseId } = await params; return NextResponse.json(releasedBookResponse(await ownedRelease(owner, releaseId)), { headers: { 'Cache-Control': 'private, no-store' } }); }
  catch (error) { return releaseErrorResponse(error); }
}
