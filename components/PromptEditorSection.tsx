'use client';

import { FormField } from '@/components/FormField';
import { Input } from '@/components/Input';
import { Textarea } from '@/components/Textarea';
import { PromptBuilderConfig, PromptConfig } from '@/types';
import _util from '@/utils/_util';

interface PromptEditorSectionProps {
  prompt: PromptConfig;
  promptBuilder: PromptBuilderConfig;
  onPromptChange: (field: keyof PromptConfig, value: string) => void;
  onPromptBuilderChange: (field: keyof PromptBuilderConfig, value: string) => void;
  promptLegend?: string;
  promptBuilderLegend?: string;
}

export function PromptEditorSection({
  prompt,
  promptBuilder,
  onPromptChange,
  onPromptBuilderChange,
  promptLegend = 'Prompts',
  promptBuilderLegend = 'Prompt Builder',
}: PromptEditorSectionProps) {
  return (
    <>
      <fieldset className="mb-4 p-4 border border-border rounded bg-card/50">
        <legend className="font-semibold text-secondary px-2">{promptLegend}</legend>

        <FormField label="[DEPRECATED]Narrator:">
          <Textarea
            value={_util.toInputString(prompt.narrator)}
            onChange={(e) => onPromptChange('narrator', e.target.value)}
            rows={4}
          />
        </FormField>

        <FormField label="Input Tag:">
          <Input
            type="text"
            value={_util.toInputString(prompt.inputTag)}
            onChange={(e) => onPromptChange('inputTag', e.target.value)}
          />
        </FormField>

        <FormField label="[DEPRECATED]Summarizer:">
          <Textarea
            value={_util.toInputString(prompt.summarizer)}
            onChange={(e) => onPromptChange('summarizer', e.target.value)}
            rows={4}
          />
        </FormField>

        <FormField label="[DEPRECATED]Summarizer End State:">
          <Textarea
            value={_util.toInputString(prompt.summarizerEndState)}
            onChange={(e) => onPromptChange('summarizerEndState', e.target.value)}
            rows={4}
          />
        </FormField>
      </fieldset>

      <fieldset className="mb-4 p-4 border border-border rounded bg-card/50">
        <legend className="font-semibold text-secondary px-2">{promptBuilderLegend}</legend>

        <FormField label="Narration 1:">
          <Textarea
            value={_util.toInputString(promptBuilder.narration1)}
            onChange={(e) => onPromptBuilderChange('narration1', e.target.value)}
            rows={4}
          />
        </FormField>

        <FormField label="Narration 2:">
          <Textarea
            value={_util.toInputString(promptBuilder.narration2)}
            onChange={(e) => onPromptBuilderChange('narration2', e.target.value)}
            rows={4}
          />
        </FormField>

        <FormField label="Enhancer:">
          <Textarea
            value={_util.toInputString(promptBuilder.enhancer)}
            onChange={(e) => onPromptBuilderChange('enhancer', e.target.value)}
            rows={4}
          />
        </FormField>

        <FormField label="Segment Summarizer:">
          <Textarea
            value={_util.toInputString(promptBuilder.segmentSummarizer)}
            onChange={(e) => onPromptBuilderChange('segmentSummarizer', e.target.value)}
            rows={4}
          />
        </FormField>

        <FormField label="Chapter Summarizer:">
          <Textarea
            value={_util.toInputString(promptBuilder.chapterSummarizer)}
            onChange={(e) => onPromptBuilderChange('chapterSummarizer', e.target.value)}
            rows={4}
          />
        </FormField>

        <FormField label="Outline Idea Generator:">
          <Textarea
            value={_util.toInputString(promptBuilder.outlineIdeaGenerator)}
            onChange={(e) => onPromptBuilderChange('outlineIdeaGenerator', e.target.value)}
            rows={4}
          />
        </FormField>

        <FormField label="Note Initializer:">
          <Textarea
            value={_util.toInputString(promptBuilder.noteInitializer)}
            onChange={(e) => onPromptBuilderChange('noteInitializer', e.target.value)}
            rows={4}
          />
        </FormField>

        <FormField label="Note Updater:">
          <Textarea
            value={_util.toInputString(promptBuilder.noteUpdater)}
            onChange={(e) => onPromptBuilderChange('noteUpdater', e.target.value)}
            rows={4}
          />
        </FormField>
      </fieldset>
    </>
  );
}