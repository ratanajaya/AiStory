import { NextResponse } from 'next/server';
import { BookModel } from '@/models';
import dbConnect from '@/lib/mongodb';
import { getActor, guardGuestMutation } from '@/lib/guest';
import { errorResponse, errorResponseFromMessage } from '@/lib/apiError';
import { parseBookDraft } from '@/lib/bookMutationValidation';

async function patchHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getActor();
    if (!actor) return errorResponseFromMessage('Unauthorized', 401);
    const body = await request.json();
    const draft = parseBookDraft(body);
    if (!draft) return errorResponseFromMessage('Invalid draft', 400);
    await dbConnect();
    const { id } = await params;
    const result = await BookModel.updateOne({ bookId: id, ...actor.filter }, { $set: draft });
    if (!result.matchedCount) return errorResponseFromMessage('Book not found', 404);
    return NextResponse.json({ success: true });
  } catch (error) { return errorResponse(error); }
}

export const PATCH = guardGuestMutation(patchHandler);
