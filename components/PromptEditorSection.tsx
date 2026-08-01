'use client';

import { FormField } from '@/components/FormField';
import { Textarea } from '@/components/Textarea';
import { PromptBuilderConfig } from '@/types';
import _util from '@/utils/_util';

interface PromptEditorSectionProps {
  promptBuilder: PromptBuilderConfig;
  onPromptBuilderChange: (field: keyof PromptBuilderConfig, value: string) => void;
  promptBuilderLegend?: string;
}

export function PromptEditorSection({
  promptBuilder,
  onPromptBuilderChange,
  promptBuilderLegend = 'Prompt Builder',
}: PromptEditorSectionProps) {
  return (
    <fieldset className="mb-4 p-4 border border-border rounded bg-card/50">
      <legend className="font-semibold text-secondary px-2">{promptBuilderLegend}</legend>

      <FormField label="Narration system prompt:">
        <Textarea
          value={_util.toInputString(promptBuilder.narrationSystem)}
          onChange={(e) => onPromptBuilderChange('narrationSystem', e.target.value)}
          rows={6}
        />
      </FormField>

      <FormField label="Narration context:">
        <Textarea
          value={_util.toInputString(promptBuilder.narration1)}
          onChange={(e) => onPromptBuilderChange('narration1', e.target.value)}
          rows={4}
        />
      </FormField>

      <FormField label="Narration request:">
        <Textarea
          value={_util.toInputString(promptBuilder.narration2)}
          onChange={(e) => onPromptBuilderChange('narration2', e.target.value)}
          rows={4}
        />
      </FormField>

      <FormField label="Enhancer system prompt:">
        <Textarea
          value={_util.toInputString(promptBuilder.enhancerSystem)}
          onChange={(e) => onPromptBuilderChange('enhancerSystem', e.target.value)}
          rows={5}
        />
      </FormField>

      <FormField label="Enhancer request:">
        <Textarea
          value={_util.toInputString(promptBuilder.enhancer)}
          onChange={(e) => onPromptBuilderChange('enhancer', e.target.value)}
          rows={4}
        />
      </FormField>

      <FormField label="Segment summarizer system prompt:">
        <Textarea
          value={_util.toInputString(promptBuilder.segmentSummarizerSystem)}
          onChange={(e) => onPromptBuilderChange('segmentSummarizerSystem', e.target.value)}
          rows={5}
        />
      </FormField>

      <FormField label="Segment summarizer request:">
        <Textarea
          value={_util.toInputString(promptBuilder.segmentSummarizer)}
          onChange={(e) => onPromptBuilderChange('segmentSummarizer', e.target.value)}
          rows={4}
        />
      </FormField>

      <FormField label="Chapter summarizer system prompt:">
        <Textarea
          value={_util.toInputString(promptBuilder.chapterSummarizerSystem)}
          onChange={(e) => onPromptBuilderChange('chapterSummarizerSystem', e.target.value)}
          rows={5}
        />
      </FormField>

      <FormField label="Chapter summarizer request:">
        <Textarea
          value={_util.toInputString(promptBuilder.chapterSummarizer)}
          onChange={(e) => onPromptBuilderChange('chapterSummarizer', e.target.value)}
          rows={4}
        />
      </FormField>

      <FormField label="Outline generator system prompt:">
        <Textarea
          value={_util.toInputString(promptBuilder.outlineIdeaGeneratorSystem)}
          onChange={(e) => onPromptBuilderChange('outlineIdeaGeneratorSystem', e.target.value)}
          rows={5}
        />
      </FormField>

      <FormField label="Outline generator request:">
        <Textarea
          value={_util.toInputString(promptBuilder.outlineIdeaGenerator)}
          onChange={(e) => onPromptBuilderChange('outlineIdeaGenerator', e.target.value)}
          rows={4}
        />
      </FormField>
    </fieldset>
  );
}
