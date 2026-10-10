import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { BookModel } from '@/models';
import { getActor, sameOrigin, guardGuestMutation } from '@/lib/guest';
import { errorResponse, errorResponseFromMessage } from '@/lib/apiError';
import { parseActiveStatus } from '@/lib/bookMutationValidation';

async function patchHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getActor();
    if (!actor) return errorResponseFromMessage('Unauthorized', 401);
    if (!sameOrigin(request)) return errorResponseFromMessage('Invalid origin', 403);
    const body = await request.json().catch(() => null);
    const status = parseActiveStatus(body);
    if (!status) return errorResponseFromMessage('Expected an isActive boolean', 400);
    await dbConnect();
    const { id } = await params;
    const item = await BookModel.findOneAndUpdate(
      { bookId: id, ...actor.filter },
      { $set: status },
      { new: true, runValidators: true },
    );
    if (!item) return errorResponseFromMessage('Book not found', 404);
    return NextResponse.json({ bookId: item.bookId, isActive: item.isActive });
  } catch (error) { return errorResponse(error); }
}

export const PATCH = guardGuestMutation(patchHandler);
