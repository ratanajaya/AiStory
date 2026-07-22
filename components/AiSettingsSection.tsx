'use client';

import { FormField } from '@/components/FormField';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { AiModelOption, ApiKeyConfig } from '@/types';
import _constant from '@/utils/_constant';
import _util from '@/utils/_util';

interface SelectOption {
  value: string;
  label: string;
}

interface AiSettingsSectionProps {
  selectedService: string;
  selectedModel: string;
  apiKey: ApiKeyConfig;
  onServiceChange: (service: string) => void;
  onModelChange: (model: string) => void;
  onApiKeyChange: (key: keyof ApiKeyConfig, value: string) => void;
  togetherModels?: AiModelOption[];
  modelLoading?: boolean;
  modelLoadError?: string | null;
  llmError?: string | null;
  variant?: 'page' | 'sidebar';
  llmTitle?: string;
  apiKeyTitle?: string;
}

function PageSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="mb-4 p-4 border border-border rounded bg-card/50">
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
  togetherModels = [],
  modelLoading = false,
  modelLoadError = null,
  llmError = null,
  variant = 'page',
  llmTitle = 'LLM Configuration',
  apiKeyTitle = 'API Keys',
}: AiSettingsSectionProps) {
  const isPage = variant === 'page';
  const isSupportedService = selectedService in _constant.llmServices;
  const isTogetherSelected = selectedService === 'together';

  const availableModels = selectedService && isSupportedService
    ? _constant.llmServices[selectedService as keyof typeof _constant.llmServices].models
    : [];

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

  const modelOptions: SelectOption[] = isTogetherSelected
    ? togetherModels.map((model) => ({
        value: model.id,
        label: model.label === model.id ? model.id : `${model.label} (${model.id})`,
      }))
    : availableModels.map((model) => ({
        value: model,
        label: model,
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
      <FormField label="Provider:">
        <Select
          value={selectedService}
          onChange={(e) => onServiceChange(e.target.value)}
          options={serviceOptions}
          placeholder="Select a provider"
        />
      </FormField>

      <FormField label="Model:">
        <Select
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

  const apiKeyFields = (
    <>
      <FormField label="Together:">
        <Input
          type="password"
          value={_util.toInputString(apiKey.together)}
          onChange={(e) => onApiKeyChange('together', e.target.value)}
          placeholder="Together API key"
        />
      </FormField>

      <FormField label="OpenAI:">
        <Input
          type="password"
          value={_util.toInputString(apiKey.openAi)}
          onChange={(e) => onApiKeyChange('openAi', e.target.value)}
          placeholder="OpenAI API key"
        />
      </FormField>
    </>
  );

  if (isPage) {
    return (
      <>
        <PageSection title={llmTitle}>{llmFields}</PageSection>
        <PageSection title={apiKeyTitle}>{apiKeyFields}</PageSection>
      </>
    );
  }

  return (
    <>
      <SidebarSection title={llmTitle}>{llmFields}</SidebarSection>
      <SidebarSection title={apiKeyTitle} titleClassName="font-semibold text-secondary text-sm pt-2">
        {apiKeyFields}
      </SidebarSection>
    </>
  );
}
