import { GUEST_STORAGE_LIMITS } from '@/lib/guestLimits';
import { NextResponse } from 'next/server';
import shortid from 'shortid';
import dbConnect from '@/lib/mongodb';
import { BookModel, TemplateModel } from '@/models';
import { getActor, getOrCreateActor, getGuestWorkspace, sameOrigin, guardGuestMutation } from '@/lib/guest';
import { errorResponse, errorResponseFromMessage } from '@/lib/apiError';

export async function GET(request: Request) {
  try {
    const actor = await getActor();
    if (!actor) return NextResponse.json([]);
    const ownership = actor.filter;

    await dbConnect();
    const { searchParams } = new URL(request.url);
    const select = searchParams.get('select');

    let query = BookModel.find({ ...ownership });

    if (select) {
      // Convert comma-separated string to space-separated string for Mongoose select
      const fields = select.split(',').join(' ');
      query = query.select(fields);
    }

    const books = await query;
    return NextResponse.json(books);
  } catch (err) {
    return errorResponse(err);
  }
}

async function postHandler(request: Request) {
  try {
    if (!sameOrigin(request)) return errorResponseFromMessage('Invalid origin', 403);
    const actor = await getOrCreateActor();
    const ownership = actor.filter;

    await dbConnect();
    const body = await request.json();
    const { templateId } = body;

    if (typeof templateId !== 'string' || !templateId.trim()) {
      return errorResponseFromMessage('templateId is required', 400);
    }

    if (!await TemplateModel.exists({ templateId, ...ownership })) return errorResponseFromMessage('Template not found', 404);
    if (actor.kind === 'guest' && await BookModel.countDocuments({ guestId: actor.guestId }) >= GUEST_STORAGE_LIMITS.books) return errorResponseFromMessage('Guest book limit reached', 429);
    const expiresAt = actor.kind === 'guest' ? { expiresAt: (await getGuestWorkspace())!.expiresAt } : {};
    const newBook = {
      bookId: shortid.generate(),
      templateId,
      name: null,
      storySegments: [],
      segmentSummaries: [],
      chapters: [],
      longTermMemory: {
        content: { schemaVersion: 1, entries: {} },
        revision: 0,
        checkpoint: { throughSegmentId: null, fingerprint: null },
        updatedAt: null,
      },
      ...ownership,
      ...expiresAt
    };

    const book = await BookModel.create(newBook);
    return NextResponse.json({ bookId: book.bookId }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

export const POST = guardGuestMutation(postHandler);
