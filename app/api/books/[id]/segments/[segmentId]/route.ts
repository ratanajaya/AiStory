import { NextResponse } from 'next/server';
import { getActor, guardGuestMutation } from '@/lib/guest';
import { errorResponse, errorResponseFromMessage } from '@/lib/apiError';
import { parseStorySegment } from '@/lib/bookMutationValidation';
import dbConnect from '@/lib/mongodb';
import { BookModel } from '@/models';

async function patchHandler(
  request: Request,
  { params }: { params: Promise<{ id: string; segmentId: string }> }
) {
  try {
    const actor = await getActor();
    if (!actor) return errorResponseFromMessage('Unauthorized', 401);
    const ownership = actor.filter;
    const { id, segmentId } = await params;
    const body = await request.json();
    const segment = parseStorySegment({
      ...(body && typeof body === 'object' ? body : {}),
      id: segmentId,
    });

    if (!segment) {
      return errorResponseFromMessage('Invalid segment data', 400);
    }

    await dbConnect();
    const book = await BookModel.findOneAndUpdate(
      { bookId: id, ...ownership, 'storySegments.id': segmentId },
      { $set: { 'storySegments.$': segment } },
      { new: true, runValidators: true }
    );

    if (!book) {
      return errorResponseFromMessage('Segment not found', 404);
    }

    return NextResponse.json(segment);
  } catch (err) {
    return errorResponse(err);
  }
}

async function deleteHandler(
  request: Request,
  { params }: { params: Promise<{ id: string; segmentId: string }> }
) {
  try {
    const actor = await getActor();
    if (!actor) return errorResponseFromMessage('Unauthorized', 401);
    const ownership = actor.filter;
    const { id, segmentId } = await params;

    await dbConnect();
    const book = await BookModel.findOneAndUpdate(
      { bookId: id, ...ownership, 'storySegments.id': segmentId },
      { $pull: { storySegments: { id: segmentId } } },
      { new: true }
    );

    if (!book) {
      return errorResponseFromMessage('Segment not found', 404);
    }

    return NextResponse.json({ segmentId });
  } catch (err) {
    return errorResponse(err);
  }
}

export const PATCH = guardGuestMutation(patchHandler);
export const DELETE = guardGuestMutation(deleteHandler);
