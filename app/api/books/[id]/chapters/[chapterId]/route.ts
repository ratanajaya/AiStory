import { NextResponse } from 'next/server';
import { getActor, guardGuestMutation } from '@/lib/guest';
import { errorResponse, errorResponseFromMessage } from '@/lib/apiError';
import { parseChapter } from '@/lib/bookMutationValidation';
import dbConnect from '@/lib/mongodb';
import { BookModel } from '@/models';

async function patchHandler(
  request: Request,
  { params }: { params: Promise<{ id: string; chapterId: string }> }
) {
  try {
    const actor = await getActor();
    if (!actor) return errorResponseFromMessage('Unauthorized', 401);
    const ownership = actor.filter;
    const { id, chapterId } = await params;
    const body = await request.json();
    const chapter = parseChapter({
      ...(body && typeof body === 'object' ? body : {}),
      id: chapterId,
    });

    if (!chapter) {
      return errorResponseFromMessage('Invalid chapter data', 400);
    }

    await dbConnect();
    const book = await BookModel.findOneAndUpdate(
      { bookId: id, ...ownership, 'chapters.id': chapterId },
      { $set: { 'chapters.$': chapter } },
      { new: true, runValidators: true }
    );

    if (!book) {
      return errorResponseFromMessage('Chapter not found', 404);
    }

    return NextResponse.json(chapter);
  } catch (err) {
    return errorResponse(err);
  }
}

export const PATCH = guardGuestMutation(patchHandler);
