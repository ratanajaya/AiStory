import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { TemplateModel, KeyValueModel } from '@/models';
import { DefaultValue, KeyValue, PromptBuilderConfig, PromptConfig } from '@/types';
import { auth } from '@/auth';
import _util from '@/utils/_util';

function mergePromptWithDefaults(prompt: PromptConfig, defaultPrompt: PromptConfig): PromptConfig {
  return {
    narrator: _util.mergeNormalizedString(prompt.narrator, defaultPrompt.narrator),
    inputTag: _util.mergeNormalizedString(prompt.inputTag, defaultPrompt.inputTag),
    summarizer: _util.mergeNormalizedString(prompt.summarizer, defaultPrompt.summarizer),
    summarizerEndState: _util.mergeNormalizedString(prompt.summarizerEndState, defaultPrompt.summarizerEndState),
  };
}

function mergePromptBuilderWithDefaults(
  promptBuilder: PromptBuilderConfig,
  defaultPromptBuilder: PromptBuilderConfig
): PromptBuilderConfig {
  return {
    narration1: _util.mergeNormalizedString(promptBuilder.narration1, defaultPromptBuilder.narration1),
    narration2: _util.mergeNormalizedString(promptBuilder.narration2, defaultPromptBuilder.narration2),
    enhancer: _util.mergeNormalizedString(promptBuilder.enhancer, defaultPromptBuilder.enhancer),
    segmentSummarizer: _util.mergeNormalizedString(
      promptBuilder.segmentSummarizer,
      defaultPromptBuilder.segmentSummarizer
    ),
    chapterSummarizer: _util.mergeNormalizedString(
      promptBuilder.chapterSummarizer,
      defaultPromptBuilder.chapterSummarizer
    ),
    outlineIdeaGenerator: _util.mergeNormalizedString(
      promptBuilder.outlineIdeaGenerator,
      defaultPromptBuilder.outlineIdeaGenerator
    ),
    noteInitializer: _util.mergeNormalizedString(
      promptBuilder.noteInitializer,
      defaultPromptBuilder.noteInitializer
    ),
    noteUpdater: _util.mergeNormalizedString(promptBuilder.noteUpdater, defaultPromptBuilder.noteUpdater),
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
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Fetch default values and merge prompts
    const defaultDoc = await KeyValueModel.findOne<KeyValue>({ key: 'defaultValue' });
    if (defaultDoc?.value) {
      const defaultValue = defaultDoc.value as DefaultValue;
      const mergedPrompt = mergePromptWithDefaults(template.prompt, defaultValue.prompt);
      const mergedPromptBuilder = mergePromptBuilderWithDefaults(
        template.promptBuilder,
        defaultValue.promptBuilder
      );

      const templateObj = template.toObject();
      return NextResponse.json({
        ...templateObj,
        prompt: mergedPrompt,
        promptBuilder: mergedPromptBuilder,
      });
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 });
  }
}
