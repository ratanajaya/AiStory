import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { TemplateModel, KeyValueModel } from '@/models';
import { DefaultValue, KeyValue, PromptBuilderConfig } from '@/types';
import { auth } from '@/auth';
import _util from '@/utils/_util';
import { errorResponse, errorResponseFromMessage } from '@/lib/apiError';

function mergePromptBuilderWithDefaults(
  promptBuilder: PromptBuilderConfig,
  defaultPromptBuilder: PromptBuilderConfig
): PromptBuilderConfig {
  return {
    narration1: _util.mergeNormalizedString(promptBuilder.narration1, defaultPromptBuilder.narration1),
    narration2: _util.mergeNormalizedString(promptBuilder.narration2, defaultPromptBuilder.narration2),
    narrationSystem: _util.mergeNormalizedString(promptBuilder.narrationSystem, defaultPromptBuilder.narrationSystem),
    enhancer: _util.mergeNormalizedString(promptBuilder.enhancer, defaultPromptBuilder.enhancer),
    enhancerSystem: _util.mergeNormalizedString(promptBuilder.enhancerSystem, defaultPromptBuilder.enhancerSystem),
    segmentSummarizer: _util.mergeNormalizedString(
      promptBuilder.segmentSummarizer,
      defaultPromptBuilder.segmentSummarizer
    ),
    segmentSummarizerSystem: _util.mergeNormalizedString(
      promptBuilder.segmentSummarizerSystem,
      defaultPromptBuilder.segmentSummarizerSystem
    ),
    chapterSummarizer: _util.mergeNormalizedString(
      promptBuilder.chapterSummarizer,
      defaultPromptBuilder.chapterSummarizer
    ),
    chapterSummarizerSystem: _util.mergeNormalizedString(
      promptBuilder.chapterSummarizerSystem,
      defaultPromptBuilder.chapterSummarizerSystem
    ),
    outlineIdeaGenerator: _util.mergeNormalizedString(
      promptBuilder.outlineIdeaGenerator,
      defaultPromptBuilder.outlineIdeaGenerator
    ),
    outlineIdeaGeneratorSystem: _util.mergeNormalizedString(
      promptBuilder.outlineIdeaGeneratorSystem,
      defaultPromptBuilder.outlineIdeaGeneratorSystem
    ),
  };
}

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
        ...templateObj,
        promptBuilder: mergedPromptBuilder,
      });
    }

    return NextResponse.json(template);
  } catch (err) {
    return errorResponse(err);
  }
}
