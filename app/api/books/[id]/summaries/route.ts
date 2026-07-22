import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { errorResponse, errorResponseFromMessage } from '@/lib/apiError';
import { parseSegmentIds, parseSegmentSummary } from '@/lib/bookMutationValidation';
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
    const summary = parseSegmentSummary(body?.summary);

    if (!segmentIds || !summary) {
      return errorResponseFromMessage('Invalid summary data', 400);
    }

    await dbConnect();
    const book = await BookModel.findOneAndUpdate(
      {
        bookId: id,
        ownerEmail,
        'storySegments.id': { $all: segmentIds },
        'segmentSummaries.id': { $ne: summary.id },
      },
      {
        $push: { segmentSummaries: summary },
        $set: {
          'storySegments.$[segment].segmentSummaryId': summary.id,
          'storySegments.$[segment].toSummarize': false,
        },
      },
      {
        arrayFilters: [{ 'segment.id': { $in: segmentIds } }],
        new: true,
        runValidators: true,
      }
    );

    if (!book) {
      const exists = await BookModel.exists({ bookId: id, ownerEmail });
      return errorResponseFromMessage(exists ? 'Segments changed or summary id already exists' : 'Book not found', exists ? 409 : 404);
    }

    return NextResponse.json({ summary, segmentIds });
  } catch (err) {
    return errorResponse(err);
  }
}
