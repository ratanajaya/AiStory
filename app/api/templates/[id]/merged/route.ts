import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { TemplateModel, KeyValueModel } from '@/models';
import { DefaultValue, KeyValue } from '@/types';
import { getActor } from '@/lib/guest';
import { mergePromptBuilderWithDefaults } from '@/lib/promptBuilderConfig';
import { visibleTemplate } from '@/lib/templateVisibility';
import { errorResponse, errorResponseFromMessage } from '@/lib/apiError';

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

    // Fetch default values and merge prompt builder values.
    const defaultDoc = await KeyValueModel.findOne<KeyValue>({ key: 'defaultValue' });
    if (defaultDoc?.value) {
      const defaultValue = defaultDoc.value as DefaultValue;
      const mergedPromptBuilder = mergePromptBuilderWithDefaults(
        template.promptBuilder,
        defaultValue.promptBuilder
      );

      const templateObj = template.toObject();
      return NextResponse.json({
        ...visibleTemplate(templateObj, actor.isAdmin),
        promptBuilder: mergedPromptBuilder,
      });
    }

    return NextResponse.json({
      ...visibleTemplate(template.toObject(), actor.isAdmin),
      promptBuilder: mergePromptBuilderWithDefaults(template.promptBuilder),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
