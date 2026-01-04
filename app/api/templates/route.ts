import { NextResponse } from 'next/server';
import dbConnect from '@/app/lib/mongodb';
import { TemplateModel } from '@/app/models';

export async function GET() {
  try {
    await dbConnect();
    const templates = await TemplateModel.find({});
    return NextResponse.json(templates);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();
    const template = await TemplateModel.create(body);
    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}
