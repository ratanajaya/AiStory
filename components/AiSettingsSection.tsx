'use client';

import { useId } from 'react';
import { FormField } from '@/components/FormField';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { AutocompleteModelSelect, type AutocompleteModelSelectProps } from '@/components/AutocompleteModelSelect';
import { AiModelOption, ApiKeyConfig, LLMService } from '@/types';
import { isSupportedLlmService, supportedLlmServices } from '@/lib/llmSettings';
import _constant from '@/utils/_constant';
import _util from '@/utils/_util';

interface SelectOption {
  value: string;
  label: string;
}

interface AiSettingsSectionProps {
  selectedService: string;
  selectedModel: string;
  apiKey: Partial<ApiKeyConfig>;
  onServiceChange: (service: string) => void;
  onModelChange: (model: string) => void;
  onApiKeyChange: (key: keyof ApiKeyConfig, value: string) => void;
  onApiKeyBlur: (service: LLMService, value: string) => void;
  keysDisabled?: boolean;
  models?: AiModelOption[];
  modelLoading?: boolean;
  modelLoadError?: string | null;
  llmError?: string | null;
  variant?: 'page' | 'sidebar';
  llmTitle?: string;
  apiKeyTitle?: string;
  autocomplete: AutocompleteModelSelectProps;
}

function PageSection({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <fieldset id={id} className="mb-4 p-4 border border-border rounded bg-card/50">
      <legend className="font-semibold text-secondary px-2">{title}</legend>
      {children}
    </fieldset>
  );
}

function SidebarSection({
  title,
  children,
  titleClassName = 'font-semibold text-secondary text-sm',
}: {
  title: string;
  children: React.ReactNode;
  titleClassName?: string;
}) {
  return (
    <div>
      <h3 className={titleClassName}>{title}</h3>
      {children}
    </div>
  );
}

export function AiSettingsSection({
  selectedService,
  selectedModel,
  apiKey,
  onServiceChange,
  onModelChange,
  onApiKeyChange,
  onApiKeyBlur,
  keysDisabled = false,
  models = [],
  modelLoading = false,
  modelLoadError = null,
  llmError = null,
  variant = 'page',
  llmTitle = 'LLM Configuration',
  apiKeyTitle = 'API Keys',
  autocomplete,
}: AiSettingsSectionProps) {
  const id = useId();
  const isPage = variant === 'page';
  const isSupportedService = isSupportedLlmService(selectedService);

  const serviceOptions: SelectOption[] = Object.entries(_constant.llmServices).map(([key, service]) => ({
    value: key,
    label: service.label,
  }));

  if (selectedService && !isSupportedService) {
    serviceOptions.unshift({
      value: selectedService,
      label: `${selectedService} (unsupported)`,
    });
  }

  const modelOptions: SelectOption[] = models.map((model) => ({
        value: model.id,
        label: model.label === model.id ? model.id : `${model.label} (${model.id})`,
      }));

  if (selectedModel && !modelOptions.some((option) => option.value === selectedModel)) {
    modelOptions.unshift({
      value: selectedModel,
      label: `${selectedModel} (unavailable)`,
    });
  }

  const modelPlaceholder = modelLoading ? 'Loading models...' : 'Select a model';
  const modelDisabled = !selectedService || !isSupportedService || modelLoading;

  const llmFields = (
    <>
      <FormField label="Provider" htmlFor={`${id}-provider`}>
        <Select
          id={`${id}-provider`}
          value={selectedService}
          onChange={(e) => onServiceChange(e.target.value)}
          options={serviceOptions}
          placeholder="Select a provider"
        />
      </FormField>

      <FormField label="Model" htmlFor={`${id}-model`}>
        <Select
          id={`${id}-model`}
          value={selectedModel}
          onChange={(e) => onModelChange(e.target.value)}
          options={modelOptions}
          placeholder={modelPlaceholder}
          disabled={modelDisabled}
        />
      </FormField>

      {(llmError || modelLoadError) && (
        <div className="text-sm text-red-500 -mt-2">
          {llmError || modelLoadError}
        </div>
      )}
    </>
  );

  const apiKeyFields = supportedLlmServices.map(service => {
    const label = _constant.llmServices[service].label;
    const keyId = `${id}-${service}`;
    return (
      <FormField key={service} label={label} htmlFor={keyId}>
        <Input
          id={keyId}
          name={service}
          type="password"
          autoComplete="off"
          disabled={keysDisabled}
          value={_util.toInputString(apiKey[service])}
          onChange={(e) => onApiKeyChange(service, e.target.value)}
          onBlur={(e) => onApiKeyBlur(service, e.currentTarget.value)}
          placeholder={`${label} API key`}
        />
      </FormField>
    );
  });

  if (isPage) {
    return (
      <>
        <PageSection title={llmTitle}>{llmFields}</PageSection>
        <AutocompleteModelSelect {...autocomplete} />
        <PageSection title={apiKeyTitle} id="api-keys">{apiKeyFields}</PageSection>
      </>
    );
  }

  return (
    <>
      <SidebarSection title={llmTitle}>{llmFields}</SidebarSection>
      <AutocompleteModelSelect {...autocomplete} />
      <SidebarSection title={apiKeyTitle} titleClassName="font-semibold text-secondary text-sm pt-2">
        {apiKeyFields}
      </SidebarSection>
    </>
  );
}
