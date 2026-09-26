import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { TemplateModel } from '@/models';
import { getActor, sameOrigin, guardGuestMutation } from '@/lib/guest';
import _util from '@/utils/_util';
import { visibleTemplate } from '@/lib/templateVisibility';
import { errorResponse, errorResponseFromMessage } from '@/lib/apiError';
import { validateTemplateNarrativeFields } from '@/lib/templateValidation';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await getActor();
    if (!actor) return errorResponseFromMessage('Unauthorized', 401);
    const ownership = actor.filter;

    await dbConnect();
    const { id } = await params;
    const template = await TemplateModel.findOne({
      templateId: id,
      ...ownership
    });
    if (!template) {
      return errorResponseFromMessage('Template not found', 404);
    }
    const templateObj = template.toObject();
    return NextResponse.json({
      ...visibleTemplate(templateObj, actor.isAdmin),
      promptBuilder: _util.normalizePromptBuilderConfig(templateObj.promptBuilder),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

async function putHandler(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await getActor();
    if (!actor) return errorResponseFromMessage('Unauthorized', 401);
    const ownership = actor.filter;

    const { id } = await params;
    if (!sameOrigin(request)) return errorResponseFromMessage('Invalid origin', 403);
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return errorResponseFromMessage('Invalid template', 400);
    if ('isPublic' in body && !actor.isAdmin) return errorResponseFromMessage('Only admins can publish templates', 403);
    if (!body || typeof body.name !== 'string' || !body.name.trim() || (body.imageUrl !== null && body.imageUrl !== undefined && typeof body.imageUrl !== 'string')) return errorResponseFromMessage('Invalid template fields', 400);
    if ('isPublic' in body && typeof body.isPublic !== 'boolean') return errorResponseFromMessage('isPublic must be boolean', 400);
    const narrativeFieldsResult = validateTemplateNarrativeFields(body);
    if (!narrativeFieldsResult.ok) {
      return errorResponseFromMessage(narrativeFieldsResult.message, 400);
    }

    await dbConnect();
    const normalizedBody = {
      name: body.name,
      storyBackground: narrativeFieldsResult.value.storyBackground,
      writingStyle: narrativeFieldsResult.value.writingStyle,
      imageUrl: body.imageUrl ?? null,
      promptBuilder: _util.normalizePromptBuilderConfig(body.promptBuilder),
      ...(actor.isAdmin ? { isPublic: body.isPublic === true } : {}),
    };
    const template = await TemplateModel.findOneAndUpdate(
      { templateId: id, ...ownership },
      normalizedBody,
      { new: true, runValidators: true }
    );
    if (!template) {
      return errorResponseFromMessage('Template not found', 404);
    }
    return NextResponse.json(visibleTemplate(template.toObject(), actor.isAdmin));
  } catch (err) {
    return errorResponse(err);
  }
}

async function deleteHandler(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await getActor();
    if (!actor) return errorResponseFromMessage('Unauthorized', 401);
    const ownership = actor.filter;

    await dbConnect();
    const { id } = await params;
    const template = await TemplateModel.findOneAndDelete({
      templateId: id,
      ...ownership
    });
    if (!template) {
      return errorResponseFromMessage('Template not found', 404);
    }
    return NextResponse.json({ message: 'Template deleted successfully' });
  } catch (err) {
    return errorResponse(err);
  }
}

export const PUT = guardGuestMutation(putHandler);
export const DELETE = guardGuestMutation(deleteHandler);
