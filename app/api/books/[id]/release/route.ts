import { releaseOwner, startRelease, releaseErrorResponse, NextResponse } from '@/lib/releases';
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const owner = await releaseOwner(request); const { id } = await params; return NextResponse.json(await startRelease(owner, id), { status: 201 }); }
  catch (error) { return releaseErrorResponse(error); }
}
