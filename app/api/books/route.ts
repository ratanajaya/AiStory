import { NextResponse } from 'next/server';
import dbConnect from '@/app/lib/mongodb';
import { BookModel } from '@/app/models';

export async function GET() {
  try {
    await dbConnect();
    const books = await BookModel.find({});
    return NextResponse.json(books);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch books' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();
    const book = await BookModel.create(body);
    return NextResponse.json(book, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create book' }, { status: 500 });
  }
}
