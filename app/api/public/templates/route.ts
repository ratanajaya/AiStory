import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { TemplateModel } from '@/models';
import { errorResponse } from '@/lib/apiError';

export async function GET() {
  try {
    await dbConnect();
    const templates = await TemplateModel.find({ isPublic: true, ownerEmail: { $exists: true } })
      .select('templateId name storyBackground imageUrl').sort({ createdAt: -1 }).lean();
    return NextResponse.json(templates.map(({ templateId, name, storyBackground, imageUrl }) => ({ templateId, name, storyBackground, imageUrl })));
  } catch (error) { return errorResponse(error); }
}
