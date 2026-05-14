import { NextResponse } from 'next/server';
import shortid from 'shortid';
import dbConnect from '@/lib/mongodb';
import { TemplateModel } from '@/models';
import { auth } from '@/auth';
import _util from '@/utils/_util';

export async function GET() {
  try {
    const session = await auth();
    const ownerEmail = session!.user!.email!;

    await dbConnect();
    const templates = await TemplateModel.find({ ownerEmail });
    return NextResponse.json(templates);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    const ownerEmail = session!.user!.email!;

    await dbConnect();
    const body = await request.json();
    const templateId = shortid.generate();
    const normalizedBody = {
      ...body,
      prompt: _util.normalizePromptConfig(body.prompt),
      promptBuilder: _util.normalizePromptBuilderConfig(body.promptBuilder),
    };
    const template = await TemplateModel.create({ 
      ...normalizedBody,
      templateId,
      ownerEmail 
    });
    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}
