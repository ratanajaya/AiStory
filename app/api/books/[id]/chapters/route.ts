import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { errorResponse, errorResponseFromMessage } from '@/lib/apiError';
import { parseChapter, parseSegmentIds } from '@/lib/bookMutationValidation';
import dbConnect from '@/lib/mongodb';
import { BookModel } from '@/models';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const ownerEmail = session!.user!.email!;
    const { id } = await params;
    const body = await request.json();
    const segmentIds = parseSegmentIds(body?.segmentIds);
    const chapter = parseChapter(body?.chapter);

    if (!segmentIds || !chapter) {
      return errorResponseFromMessage('Invalid chapter data', 400);
    }

    await dbConnect();
    const book = await BookModel.findOneAndUpdate(
      {
        bookId: id,
        ownerEmail,
        'storySegments.id': { $all: segmentIds },
        'chapters.id': { $ne: chapter.id },
        $expr: {
          $eq: [
            {
              $size: {
                $filter: {
                  input: '$storySegments',
                  as: 'segment',
                  cond: {
                    $and: [
                      { $in: ['$$segment.id', segmentIds] },
                      { $eq: [{ $ifNull: ['$$segment.chapterId', null] }, null] },
                    ],
                  },
                },
              },
            },
            segmentIds.length,
          ],
        },
      },
      {
        $push: { chapters: chapter },
        $set: { 'storySegments.$[segment].chapterId': chapter.id },
      },
      {
        arrayFilters: [{ 'segment.id': { $in: segmentIds }, 'segment.chapterId': null }],
        new: true,
        runValidators: true,
      }
    );

    if (!book) {
      const exists = await BookModel.exists({ bookId: id, ownerEmail });
      return errorResponseFromMessage(exists ? 'Segments changed or chapter id already exists' : 'Book not found', exists ? 409 : 404);
    }

    return NextResponse.json({ chapter, segmentIds });
  } catch (err) {
    return errorResponse(err);
  }
}
