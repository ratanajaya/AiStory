'use client';

import { FormField } from '@/components/FormField';
import { Input } from '@/components/Input';
import { Textarea } from '@/components/Textarea';
import { PromptBuilderConfig, PromptConfig } from '@/types';

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
            value={prompt.narrator || ''}
            onChange={(e) => onPromptChange('narrator', e.target.value)}
            rows={4}
          />
        </FormField>

        <FormField label="Input Tag:">
          <Input
            type="text"
            value={prompt.inputTag || ''}
            onChange={(e) => onPromptChange('inputTag', e.target.value)}
          />
        </FormField>

        <FormField label="Summarizer:">
          <Textarea
            value={prompt.summarizer || ''}
            onChange={(e) => onPromptChange('summarizer', e.target.value)}
            rows={4}
          />
        </FormField>

        <FormField label="[DEPRECATED]Summarizer End State:">
          <Textarea
            value={prompt.summarizerEndState || ''}
            onChange={(e) => onPromptChange('summarizerEndState', e.target.value)}
            rows={4}
          />
        </FormField>
      </fieldset>

      <fieldset className="mb-4 p-4 border border-border rounded bg-card/50">
        <legend className="font-semibold text-secondary px-2">{promptBuilderLegend}</legend>

        <FormField label="Narration 1:">
          <Textarea
            value={promptBuilder.narration1 || ''}
            onChange={(e) => onPromptBuilderChange('narration1', e.target.value)}
            rows={4}
          />
        </FormField>

        <FormField label="Narration 2:">
          <Textarea
            value={promptBuilder.narration2 || ''}
            onChange={(e) => onPromptBuilderChange('narration2', e.target.value)}
            rows={4}
          />
        </FormField>

        <FormField label="Enhancer:">
          <Textarea
            value={promptBuilder.enhancer || ''}
            onChange={(e) => onPromptBuilderChange('enhancer', e.target.value)}
            rows={4}
          />
        </FormField>
      </fieldset>
    </>
  );
}