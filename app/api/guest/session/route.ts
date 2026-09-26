import { NextResponse } from 'next/server';
import { ensureGuestWorkspace, sameOrigin } from '@/lib/guest';
import { errorResponse, errorResponseFromMessage } from '@/lib/apiError';

export async function POST(request: Request) {
  if (!sameOrigin(request)) return errorResponseFromMessage('Invalid origin', 403);
  try {
    const guest = await ensureGuestWorkspace();
    return NextResponse.json({ expiresAt: guest.expiresAt });
  } catch (error) { return errorResponse(error); }
}
