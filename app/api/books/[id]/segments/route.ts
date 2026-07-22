import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { BookModel } from '@/models';
import { auth } from '@/auth';
import { errorResponse, errorResponseFromMessage } from '@/lib/apiError';
import { parseStorySegment } from '@/lib/bookMutationValidation';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const ownerEmail = session!.user!.email!;

    await dbConnect();
    const { id } = await params;
    const body = await request.json();
    const segment = parseStorySegment(body?.segment);

    if (!segment) {
      return errorResponseFromMessage('Invalid segment data', 400);
    }

    const book = await BookModel.findOneAndUpdate(
      { bookId: id, ownerEmail, 'storySegments.id': { $ne: segment.id } },
      { $push: { storySegments: segment } },
      { new: true, runValidators: true }
    );

    if (!book) {
      const exists = await BookModel.exists({ bookId: id, ownerEmail });
      return errorResponseFromMessage(exists ? 'Segment already exists' : 'Book not found', exists ? 409 : 404);
    }

    return NextResponse.json(segment);
  } catch (err) {
    return errorResponse(err);
  }
}
