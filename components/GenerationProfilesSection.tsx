'use client';

import { FormField } from '@/components/FormField';
import { InputNumber } from '@/components/InputNumber';
import type { AiGenerationFeature, GenerationProfileConfig } from '@/types';

const profileLabels: Record<AiGenerationFeature, string> = {
  default: 'Default / connectivity test',
  narration: 'Narration',
  outlineIdeaGenerator: 'Outline generator',
  enhancer: 'Enhancer',
  segmentSummarizer: 'Segment summarizer',
  chapterSummarizer: 'Chapter summarizer',
  longTermMemory: 'Long-term memory',
};

const profileFeatures = Object.keys(profileLabels) as AiGenerationFeature[];

interface GenerationProfilesSectionProps {
  generationProfiles: GenerationProfileConfig;
  onChange: (profiles: GenerationProfileConfig) => void;
}

export function GenerationProfilesSection({ generationProfiles, onChange }: GenerationProfilesSectionProps) {
  const update = <K extends keyof GenerationProfileConfig[AiGenerationFeature]>(
    feature: AiGenerationFeature,
    field: K,
    value: GenerationProfileConfig[AiGenerationFeature][K]
  ) => {
    onChange({
      ...generationProfiles,
      [feature]: {
        ...generationProfiles[feature],
        [field]: value,
      },
    });
  };

  return (
    <fieldset className="mb-4 p-4 border border-border rounded bg-card/50">
      <legend className="font-semibold text-secondary px-2">Generation Profiles</legend>
      <p className="mb-4 text-sm text-muted-foreground">Global limits and retries. Temperature is omitted when “Use provider default” is selected.</p>
      <div className="space-y-5">
        {profileFeatures.map((feature) => {
          const profile = generationProfiles[feature];
          const usesProviderDefault = profile.temperature === null;
          return (
            <div key={feature} className="rounded border border-border p-3">
              <h3 className="mb-3 text-sm font-semibold">{profileLabels[feature]}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Max output tokens">
                  <InputNumber
                    min={128}
                    max={4096}
                    value={profile.maxOutputTokens}
                    onChange={(value) => update(feature, 'maxOutputTokens', value)}
                  />
                </FormField>
                <FormField label="Timeout (ms)">
                  <InputNumber
                    min={5000}
                    max={120000}
                    step={1000}
                    value={profile.timeoutMs}
                    onChange={(value) => update(feature, 'timeoutMs', value)}
                  />
                </FormField>
                <FormField label="Retries">
                  <InputNumber
                    min={0}
                    max={2}
                    value={profile.maxRetries}
                    onChange={(value) => update(feature, 'maxRetries', value)}
                  />
                </FormField>
                <FormField label="Temperature">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={usesProviderDefault}
                        onChange={(event) => update(feature, 'temperature', event.target.checked ? null : 0.7)}
                      />
                      Use provider default
                    </label>
                    <InputNumber
                      min={0}
                      max={2}
                      step={0.1}
                      value={profile.temperature ?? 0.7}
                      disabled={usesProviderDefault}
                      onChange={(value) => update(feature, 'temperature', value)}
                    />
                  </div>
                </FormField>
              </div>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
