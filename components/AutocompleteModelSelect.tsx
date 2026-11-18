'use client';

import { useId } from 'react';
import { useAiModelCatalog } from '@/components/AiModelCatalogProvider';
import { FormField } from '@/components/FormField';
import { Select } from '@/components/Select';
import type { ApiKeyConfig, AutocompletePreference, LLMService, LlmConfig } from '@/types';
import _constant from '@/utils/_constant';

export interface AutocompleteModelSelectProps {
  value: AutocompletePreference | undefined;
  onChange: (value: AutocompletePreference) => void;
  modelKeys: ApiKeyConfig;
  inherit?: boolean;
  disabled?: boolean;
}

function optionValue(model: LlmConfig) {
  return JSON.stringify([model.service, model.model]);
}

export function AutocompleteModelSelect({ value, onChange, modelKeys, inherit, disabled }: AutocompleteModelSelectProps) {
  const id = useId();
  const { getEntry } = useAiModelCatalog();
  const catalog = (['together', 'openAi'] as const).map(service => ({ service, ...getEntry(service, modelKeys[service]) }));
  const models = new Map<string, LlmConfig>();
  const groups = catalog.map(({ service, models: entries, loading }) => {
    const options = entries.map(entry => {
      const model = { service, model: entry.id };
      const key = optionValue(model);
      models.set(key, model);
      return { value: key, label: entry.label === entry.id ? entry.id : `${entry.label} (${entry.id})` };
    });
    const currentModel = value?.model;
    if (currentModel?.service === service && !models.has(optionValue(currentModel))) {
      const key = optionValue(currentModel);
      models.set(key, currentModel);
      options.unshift({ value: key, label: loading ? currentModel.model : `${currentModel.model} (unavailable)` });
    }
    return { label: _constant.llmServices[service].label, options };
  }).filter(group => group.options.length > 0);
  const catalogStatus = catalog.map(entry => getCatalogStatus(entry)).filter(Boolean).join(' ');
  const options = [
    ...(inherit ? [{ value: 'inherit', label: 'Use admin default' }] : []),
    { value: 'off', label: 'Off' },
  ];

  return (
    <FormField label="Autocomplete model" htmlFor={id}>
      <Select
        id={id}
        value={value?.model ? optionValue(value.model) : inherit && value == null ? 'inherit' : 'off'}
        options={options}
        groups={groups}
        disabled={disabled}
        aria-describedby={catalogStatus ? `${id}-status` : undefined}
        onChange={event => {
          const key = event.target.value;
          if (key === 'inherit') onChange(null);
          else if (key === 'off') onChange({ model: null });
          else {
            const model = models.get(key);
            if (model) onChange({ model });
          }
        }}
      />
      {catalogStatus && <p id={`${id}-status`} className="mt-1 text-xs text-muted-foreground">{catalogStatus}</p>}
    </FormField>
  );
}

function getCatalogStatus(entry: { service: LLMService; loading: boolean; error: string | null }) {
  const provider = _constant.llmServices[entry.service].label;
  if (entry.loading) return `Loading ${provider} models.`;
  if (entry.error) return `Could not load ${provider} models.`;
  return '';
}
