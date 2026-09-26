import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { BookModel } from '@/models';
import { getActor, guardGuestMutation } from '@/lib/guest';
import { errorResponse, errorResponseFromMessage } from '@/lib/apiError';
import { normalizeLongTermMemoryState } from '@/lib/bookMemory';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await getActor();
    if (!actor) return errorResponseFromMessage('Unauthorized', 401);
    const ownership = actor.filter;

    await dbConnect();
    const { id } = await params;
    const book = await BookModel.findOne({
      bookId: id,
      ...ownership
    });
    if (!book) {
      return errorResponseFromMessage('Book not found', 404);
    }
    const responseBook = book.toObject();
    responseBook.longTermMemory = normalizeLongTermMemoryState(responseBook.longTermMemory);
    return NextResponse.json(responseBook);
  } catch (err) {
    return errorResponse(err);
  }
}

async function deleteHandler(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await getActor();
    if (!actor) return errorResponseFromMessage('Unauthorized', 401);
    const ownership = actor.filter;

    await dbConnect();
    const { id } = await params;
    const book = await BookModel.findOneAndDelete({
      bookId: id,
      ...ownership
    });
    if (!book) {
      return errorResponseFromMessage('Book not found', 404);
    }
    return NextResponse.json({ message: 'Book deleted successfully' });
  } catch (err) {
    return errorResponse(err);
  }
}

export const DELETE = guardGuestMutation(deleteHandler);
