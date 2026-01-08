import { NextResponse } from 'next/server';
import shortid from 'shortid';
import dbConnect from '@/lib/mongodb';
import { BookModel } from '@/models';
import { auth } from '@/auth';

export async function GET(request: Request) {
  try {
    const session = await auth();
    const ownerEmail = session!.user!.email!;

    await dbConnect();
    const { searchParams } = new URL(request.url);
    const select = searchParams.get('select');
    
    let query = BookModel.find({ ownerEmail });
    
    if (select) {
      // Convert comma-separated string to space-separated string for Mongoose select
      const fields = select.split(',').join(' ');
      query = query.select(fields);
    }
    
    const books = await query;
    return NextResponse.json(books);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch books' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    const ownerEmail = session!.user!.email!;

    await dbConnect();
    const body = await request.json();
    const { templateId } = body;

    if (!templateId) {
      return NextResponse.json({ error: 'templateId is required' }, { status: 400 });
    }

    const newBook = {
      bookId: shortid.generate(),
      templateId,
      name: null,
      storySegments: [],
      segmentSummaries: [],
      chapters: [],
      ownerEmail
    };

    const book = await BookModel.create(newBook);
    return NextResponse.json({ bookId: book.bookId }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create book' }, { status: 500 });
  }
}
