import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { TemplateModel, KeyValueModel } from '@/models';
import { DefaultValue, KeyValue, PromptBuilderConfig, PromptConfig } from '@/types';
import { auth } from '@/auth';

function mergePromptWithDefaults(prompt: PromptConfig, defaultPrompt: PromptConfig): PromptConfig {
  return {
    narrator: prompt.narrator || defaultPrompt.narrator,
    inputTag: prompt.inputTag || defaultPrompt.inputTag,
    summarizer: prompt.summarizer || defaultPrompt.summarizer,
    summarizerEndState: prompt.summarizerEndState || defaultPrompt.summarizerEndState,
  };
}

function mergePromptBuilderWithDefaults(
  promptBuilder: PromptBuilderConfig,
  defaultPromptBuilder: PromptBuilderConfig
): PromptBuilderConfig {
  return {
    narration1: promptBuilder.narration1 || defaultPromptBuilder.narration1,
    narration2: promptBuilder.narration2 || defaultPromptBuilder.narration2,
    enhancer: promptBuilder.enhancer || defaultPromptBuilder.enhancer,
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
