import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { errorResponse, errorResponseFromMessage } from '@/lib/apiError';
import { parseChapter } from '@/lib/bookMutationValidation';
import dbConnect from '@/lib/mongodb';
import { BookModel } from '@/models';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; chapterId: string }> }
) {
  try {
    const session = await auth();
    const ownerEmail = session!.user!.email!;
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
      { bookId: id, ownerEmail, 'chapters.id': chapterId },
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
