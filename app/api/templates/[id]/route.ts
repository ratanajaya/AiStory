import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { TemplateModel } from '@/models';
import { auth } from '@/auth';
import _util from '@/utils/_util';
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
    const template = await TemplateModel.findOne({
      templateId: id,
      ownerEmail
    });
    if (!template) {
      return errorResponseFromMessage('Template not found', 404);
    }
    const templateObj = template.toObject();
    return NextResponse.json({
      ...templateObj,
      promptBuilder: _util.normalizePromptBuilderConfig(templateObj.promptBuilder),
    });
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
    const normalizedBody = {
      ...body,
      promptBuilder: _util.normalizePromptBuilderConfig(body.promptBuilder),
    };
    const template = await TemplateModel.findOneAndUpdate(
      { templateId: id, ownerEmail },
      normalizedBody,
      { new: true, runValidators: true }
    );
    if (!template) {
      return errorResponseFromMessage('Template not found', 404);
    }
    return NextResponse.json(template);
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
    const template = await TemplateModel.findOneAndDelete({
      templateId: id,
      ownerEmail
    });
    if (!template) {
      return errorResponseFromMessage('Template not found', 404);
    }
    return NextResponse.json({ message: 'Template deleted successfully' });
  } catch (err) {
    return errorResponse(err);
  }
}
