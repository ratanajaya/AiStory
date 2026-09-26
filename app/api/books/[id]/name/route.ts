import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { BookModel } from '@/models';
import { getActor, guardGuestMutation } from '@/lib/guest';
import { errorResponse, errorResponseFromMessage } from '@/lib/apiError';

async function patchHandler(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await getActor();
    if (!actor) return errorResponseFromMessage('Unauthorized', 401);
    const ownership = actor.filter;

    await dbConnect();
    const { id } = await params;
    const body = await request.json();

    // Validate that name is provided
    if (typeof body.name !== 'string') {
      return errorResponseFromMessage('Name must be a string', 400);
    }

    // Find and update only the name field
    const book = await BookModel.findOneAndUpdate(
      { bookId: id, ...ownership },
      { name: body.name },
      { new: true, runValidators: true }
    );

    if (!book) {
      return errorResponseFromMessage('Book not found', 404);
    }

    return NextResponse.json({
      bookId: book.bookId,
      name: book.name,
      message: 'Book name updated successfully'
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export const PATCH = guardGuestMutation(patchHandler);
