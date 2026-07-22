import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { errorResponse, errorResponseFromMessage } from '@/lib/apiError';
import { parseStorySegment } from '@/lib/bookMutationValidation';
import dbConnect from '@/lib/mongodb';
import { BookModel } from '@/models';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; segmentId: string }> }
) {
  try {
    const session = await auth();
    const ownerEmail = session!.user!.email!;
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
      { bookId: id, ownerEmail, 'storySegments.id': segmentId },
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; segmentId: string }> }
) {
  try {
    const session = await auth();
    const ownerEmail = session!.user!.email!;
    const { id, segmentId } = await params;

    await dbConnect();
    const book = await BookModel.findOneAndUpdate(
      { bookId: id, ownerEmail, 'storySegments.id': segmentId },
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
