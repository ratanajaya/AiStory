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

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const ownerEmail = session!.user!.email!;

    await dbConnect();
    const { id } = await params;
    const body = await request.json();

    // Version control: Check if the incoming version matches the current version
    const currentBook = await BookModel.findOne({ bookId: id, ownerEmail });

    if (!currentBook) {
      return errorResponseFromMessage('Book not found', 404);
    }

    if (body.version !== currentBook.version) {
      return errorResponseFromMessage(
        'Version conflict: This book has been modified by another session. Please refresh and try again.',
        409,
      );
    }

    // Increment version on the backend
    const updatedData = {
      ...body,
      version: currentBook.version + 1,
    };

    const book = await BookModel.findOneAndUpdate(
      { bookId: id, ownerEmail },
      updatedData,
      { new: true, runValidators: true }
    );
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
