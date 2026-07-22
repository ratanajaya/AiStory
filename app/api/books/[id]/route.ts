import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { BookModel } from '@/models';
import { auth } from '@/auth';
import { errorResponse, errorResponseFromMessage } from '@/lib/apiError';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const ownerEmail = session!.user!.email!;

    await dbConnect();
    const { id } = await params;
    const book = await BookModel.findOne({
      bookId: id,
      ownerEmail
    });
    if (!book) {
      return errorResponseFromMessage('Book not found', 404);
    }
    return NextResponse.json(book);
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
    const book = await BookModel.findOneAndDelete({
      bookId: id,
      ownerEmail
    });
    if (!book) {
      return errorResponseFromMessage('Book not found', 404);
    }
    return NextResponse.json({ message: 'Book deleted successfully' });
  } catch (err) {
    return errorResponse(err);
  }
}
