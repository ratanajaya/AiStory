'use client';

import { useId, useState } from 'react';
import { FormField } from '@/components/FormField';
import { Textarea } from '@/components/Textarea';
import { NarrationMode, PromptBuilderConfig } from '@/types';
import { defaultNarrationModePrompts, narrationModeIds, narrationModes } from '@/lib/narrationModes';
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
  const [mode, setMode] = useState<NarrationMode>('outline');
  const id = useId();
  const { systemField, requestField } = narrationModes[mode];
  const systemDefault = mode === 'outline' ? undefined : defaultNarrationModePrompts[systemField as keyof typeof defaultNarrationModePrompts];
  const requestDefault = mode === 'outline' ? undefined : defaultNarrationModePrompts[requestField as keyof typeof defaultNarrationModePrompts];
  return (
    <fieldset className="mb-4 p-4 border border-border rounded bg-card/50">
      <legend className="font-semibold text-secondary px-2">{promptBuilderLegend}</legend>

      <FormField label="Narration context (shared by all writing modes):" htmlFor={`${id}-context`}>
        <Textarea
          id={`${id}-context`}
          value={_util.toInputString(promptBuilder.narration1)}
          onChange={(e) => onPromptBuilderChange('narration1', e.target.value)}
          rows={4}
        />
      </FormField>

      <div role="tablist" aria-label="Narration prompts" className="mb-3 flex flex-wrap gap-2">
        {narrationModeIds.map(value => (
          <button
            key={value}
            type="button"
            role="tab"
            id={`${id}-tab-${value}`}
            aria-selected={mode === value}
            aria-controls={`${id}-prompts`}
            className={`rounded border px-3 py-1 text-sm ${mode === value ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}
            onClick={() => setMode(value)}
          >{narrationModes[value].label}</button>
        ))}
      </div>
      <div role="tabpanel" id={`${id}-prompts`} aria-labelledby={`${id}-tab-${mode}`}>
        <p className="mb-3 text-sm text-muted-foreground">{narrationModes[mode].description}</p>
        {mode !== 'outline' && <p className="mb-3 text-xs text-muted-foreground">Blank fields use the global setting, then the built-in prompt. Shared context and template Writing Style apply.</p>}
        <FormField label="Narration system prompt:" htmlFor={`${id}-system`}>
          <Textarea
            id={`${id}-system`}
            value={_util.toInputString(promptBuilder[systemField])}
            onChange={e => onPromptBuilderChange(systemField, e.target.value)}
            placeholder={systemDefault}
            rows={6}
          />
        </FormField>
        <FormField label="Narration request:" htmlFor={`${id}-request`}>
          <Textarea
            id={`${id}-request`}
            value={_util.toInputString(promptBuilder[requestField])}
            onChange={e => onPromptBuilderChange(requestField, e.target.value)}
            placeholder={requestDefault}
            rows={4}
          />
        </FormField>
      </div>

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

      <FormField label="Outline generator system prompt (deprecated):">
        <Textarea
          value={_util.toInputString(promptBuilder.outlineIdeaGeneratorSystem)}
          onChange={(e) => onPromptBuilderChange('outlineIdeaGeneratorSystem', e.target.value)}
          rows={5}
        />
      </FormField>

      <FormField label="Outline generator request (deprecated):">
        <Textarea
          value={_util.toInputString(promptBuilder.outlineIdeaGenerator)}
          onChange={(e) => onPromptBuilderChange('outlineIdeaGenerator', e.target.value)}
          rows={4}
        />
      </FormField>
    </fieldset>
  );
}
