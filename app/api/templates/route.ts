import { GUEST_STORAGE_LIMITS } from '@/lib/guestLimits';
import { NextResponse } from 'next/server';
import shortid from 'shortid';
import dbConnect from '@/lib/mongodb';
import { TemplateModel } from '@/models';
import { getActor, getOrCreateActor, getGuestWorkspace, sameOrigin, guardGuestMutation } from '@/lib/guest';
import _util from '@/utils/_util';
import { visibleTemplate } from '@/lib/templateVisibility';
import { errorResponse, errorResponseFromMessage } from '@/lib/apiError';
import { validateTemplateNarrativeFields } from '@/lib/templateValidation';

export async function GET() {
  try {
    const actor = await getActor();
    if (!actor) return NextResponse.json([]);
    const ownership = actor.filter;

    await dbConnect();
    const templates = await TemplateModel.find({ ...ownership });
    return NextResponse.json(templates.map((template) => visibleTemplate(template.toObject(), actor.isAdmin)));
  } catch (err) {
    return errorResponse(err);
  }
}

async function postHandler(request: Request) {
  try {
    if (!sameOrigin(request)) return errorResponseFromMessage('Invalid origin', 403);
    const actor = await getOrCreateActor();
    const ownership = actor.filter;

    const body = await request.json();
    if (!body || typeof body.name !== 'string' || !body.name.trim() || (body.imageUrl !== null && body.imageUrl !== undefined && typeof body.imageUrl !== 'string')) return errorResponseFromMessage('Invalid template fields', 400);
    if ('isPublic' in body && !actor.isAdmin) return errorResponseFromMessage('Only admins can publish templates', 403);
    if ('isPublic' in body && typeof body.isPublic !== 'boolean') return errorResponseFromMessage('isPublic must be boolean', 400);
    const narrativeFieldsResult = validateTemplateNarrativeFields(body);
    if (!narrativeFieldsResult.ok) {
      return errorResponseFromMessage(narrativeFieldsResult.message, 400);
    }

    await dbConnect();
    if (actor.kind === 'guest' && await TemplateModel.countDocuments({ guestId: actor.guestId }) >= GUEST_STORAGE_LIMITS.templates) return errorResponseFromMessage('Guest template limit reached', 429);
    const templateId = shortid.generate();
    const normalizedBody = {
      name: body.name,
      storyBackground: narrativeFieldsResult.value.storyBackground,
      writingStyle: narrativeFieldsResult.value.writingStyle,
      imageUrl: body.imageUrl ?? null,
      promptBuilder: _util.normalizePromptBuilderConfig(body.promptBuilder),
      isPublic: actor.isAdmin ? body.isPublic === true : false,
    };
    const expiresAt = actor.kind === 'guest' ? { expiresAt: (await getGuestWorkspace())!.expiresAt } : {};
    const template = await TemplateModel.create({
      ...normalizedBody,
      templateId,
      ...ownership,
      ...expiresAt
    });
    return NextResponse.json(visibleTemplate(template.toObject(), actor.isAdmin), { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

export const POST = guardGuestMutation(postHandler);
