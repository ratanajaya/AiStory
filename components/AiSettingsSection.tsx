'use client';

import { FormField } from '@/components/FormField';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { ApiKeyConfig } from '@/types';
import _constant from '@/utils/_constant';

interface AiSettingsSectionProps {
  selectedService: string;
  selectedModel: string;
  apiKey: ApiKeyConfig;
  onServiceChange: (service: string) => void;
  onModelChange: (model: string) => void;
  onApiKeyChange: (key: keyof ApiKeyConfig, value: string) => void;
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
  variant = 'page',
  llmTitle = 'LLM Configuration',
  apiKeyTitle = 'API Keys',
}: AiSettingsSectionProps) {
  const isPage = variant === 'page';

  const availableModels = selectedService
    ? _constant.llmServices[selectedService as keyof typeof _constant.llmServices]?.models || []
    : [];

  const serviceOptions = Object.entries(_constant.llmServices).map(([key, service]) => ({
    value: key,
    label: service.label,
  }));

  const modelOptions = availableModels.map((model) => ({
    value: model,
    label: model,
  }));

  const llmFields = (
    <>
      <FormField label={isPage ? 'LLM Provider:' : 'Provider:'}>
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
          placeholder="Select a model"
          disabled={!selectedService}
        />
      </FormField>
    </>
  );

  const apiKeyFields = (
    <>
      <FormField label={isPage ? 'Mistral API Key:' : 'Mistral AI:'}>
        <Input
          type="password"
          value={apiKey.mistral || ''}
          onChange={(e) => onApiKeyChange('mistral', e.target.value)}
          placeholder={isPage ? 'Enter Mistral API key' : 'Mistral API key'}
        />
      </FormField>

      <FormField label={isPage ? 'Together API Key:' : 'Together AI:'}>
        <Input
          type="password"
          value={apiKey.together || ''}
          onChange={(e) => onApiKeyChange('together', e.target.value)}
          placeholder={isPage ? 'Enter Together API key' : 'Together API key'}
        />
      </FormField>

      <FormField label={isPage ? 'OpenAI API Key:' : 'OpenAI:'}>
        <Input
          type="password"
          value={apiKey.openAi || ''}
          onChange={(e) => onApiKeyChange('openAi', e.target.value)}
          placeholder={isPage ? 'Enter OpenAI API key' : 'OpenAI API key'}
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