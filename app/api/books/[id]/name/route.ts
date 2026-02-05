import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { BookModel } from '@/models';
import { auth } from '@/auth';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const ownerEmail = session!.user!.email!;

    await dbConnect();
    const { id } = await params;
    const body = await request.json();
    
    // Validate that name is provided
    if (typeof body.name !== 'string') {
      return NextResponse.json(
        { error: 'Name must be a string' },
        { status: 400 }
      );
    }

    // Find and update only the name field
    const book = await BookModel.findOneAndUpdate(
      { bookId: id, ownerEmail },
      { name: body.name },
      { new: true, runValidators: true }
    );

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      bookId: book.bookId,
      name: book.name,
      message: 'Book name updated successfully' 
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to update book name' }, { status: 500 });
  }
}
