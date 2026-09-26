import { NextResponse } from 'next/server';
import { getActor, guardGuestMutation } from '@/lib/guest';
import { errorResponse, errorResponseFromMessage } from '@/lib/apiError';
import { parseSegmentIds, parseSegmentSummary } from '@/lib/bookMutationValidation';
import dbConnect from '@/lib/mongodb';
import { BookModel } from '@/models';

async function postHandler(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await getActor();
    if (!actor) return errorResponseFromMessage('Unauthorized', 401);
    const ownership = actor.filter;
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
        ...ownership,
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
      const exists = await BookModel.exists({ bookId: id, ...ownership });
      return errorResponseFromMessage(exists ? 'Segments changed or summary id already exists' : 'Book not found', exists ? 409 : 404);
    }

    return NextResponse.json({ summary, segmentIds });
  } catch (err) {
    return errorResponse(err);
  }
}

export const POST = guardGuestMutation(postHandler);
