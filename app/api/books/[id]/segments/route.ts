import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { BookModel } from '@/models';
import { auth } from '@/auth';
import { errorResponse, errorResponseFromMessage } from '@/lib/apiError';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const ownerEmail = session!.user!.email!;

    await dbConnect();
    const { id } = await params;
    const { segment } = await request.json();

    if (!segment || !segment.id) {
      return errorResponseFromMessage('Invalid segment data', 400);
    }

    // Try to update existing segment
    const updateResult = await BookModel.findOneAndUpdate(
      { bookId: id, ownerEmail, 'storySegments.id': segment.id },
      { $set: { 'storySegments.$': segment } },
      { new: true }
    );

    if (updateResult) {
      return NextResponse.json(segment);
    }

    // Segment doesn't exist, push it
    const pushResult = await BookModel.findOneAndUpdate(
      { bookId: id, ownerEmail },
      { $push: { storySegments: segment } },
      { new: true }
    );

    if (!pushResult) {
      return errorResponseFromMessage('Book not found', 404);
    }

    return NextResponse.json(segment);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const ownerEmail = session!.user!.email!;

    await dbConnect();
    const { id } = await params;
    const { segmentId } = await request.json();

    if (!segmentId) {
      return errorResponseFromMessage('Missing segmentId', 400);
    }

    const result = await BookModel.findOneAndUpdate(
      { bookId: id, ownerEmail },
      { $pull: { storySegments: { id: segmentId } } },
      { new: true }
    );

    if (!result) {
      return errorResponseFromMessage('Book not found', 404);
    }

    return NextResponse.json({ message: 'Segment deleted' });
  } catch (err) {
    return errorResponse(err);
  }
}
