import { NextResponse } from 'next/server';
import { BookModel } from '@/models';
import dbConnect from '@/lib/mongodb';
import { getActor, guardGuestMutation } from '@/lib/guest';
import { errorResponse, errorResponseFromMessage } from '@/lib/apiError';
import _util from '@/utils/_util';

async function patchHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getActor();
    if (!actor) return errorResponseFromMessage('Unauthorized', 401);
    const body = await request.json();
    if (!body || typeof body !== 'object' || typeof body.draftOutline !== 'string' || typeof body.draftIdea !== 'string' || body.draftOutline.length > 65_536 || body.draftIdea.length > 65_536) return errorResponseFromMessage('Invalid draft', 400);
    await dbConnect();
    const { id } = await params;
    const result = await BookModel.updateOne({ bookId: id, ...actor.filter }, { $set: { draftOutline: _util.toInputString(body.draftOutline), draftIdea: _util.toInputString(body.draftIdea) } });
    if (!result.matchedCount) return errorResponseFromMessage('Book not found', 404);
    return NextResponse.json({ success: true });
  } catch (error) { return errorResponse(error); }
}

export const PATCH = guardGuestMutation(patchHandler);
