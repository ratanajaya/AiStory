import { releaseOwner, commitRelease, releaseErrorResponse, NextResponse } from '@/lib/releases';
export async function POST(request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  try { const owner = await releaseOwner(request); const { attemptId } = await params; return NextResponse.json(await commitRelease(owner, attemptId)); }
  catch (error) { return releaseErrorResponse(error); }
}
