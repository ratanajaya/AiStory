import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { BookModel } from '@/models';
import { getActor, guardGuestMutation } from '@/lib/guest';
import { errorResponse, errorResponseFromMessage } from '@/lib/apiError';
import { parseStorySegment } from '@/lib/bookMutationValidation';

async function postHandler(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await getActor();
    if (!actor) return errorResponseFromMessage('Unauthorized', 401);
    const ownership = actor.filter;

    await dbConnect();
    const { id } = await params;
    const body = await request.json();
    const segment = parseStorySegment(body?.segment);

    if (!segment) {
      return errorResponseFromMessage('Invalid segment data', 400);
    }

    const book = await BookModel.findOneAndUpdate(
      { bookId: id, ...ownership, 'storySegments.id': { $ne: segment.id } },
      { $push: { storySegments: segment } },
      { new: true, runValidators: true }
    );

    if (!book) {
      const exists = await BookModel.exists({ bookId: id, ...ownership });
      return errorResponseFromMessage(exists ? 'Segment already exists' : 'Book not found', exists ? 409 : 404);
    }

    return NextResponse.json(segment);
  } catch (err) {
    return errorResponse(err);
  }
}

export const POST = guardGuestMutation(postHandler);
