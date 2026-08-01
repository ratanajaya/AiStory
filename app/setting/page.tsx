'use client';

import { useState, useEffect } from 'react';
import { AiModelOption, DefaultValue, PromptBuilderConfig } from '@/types';
import { AiSettingsSection } from '@/components/AiSettingsSection';
import { useFetcher } from '@/components/FetcherProvider';
import { Button } from '@/components/Button';
import { PromptEditorSection } from '@/components/PromptEditorSection';
import { GenerationProfilesSection } from '@/components/GenerationProfilesSection';
import { normalizeGenerationProfileConfig } from '@/lib/generationProfiles';
import _constant from '@/utils/_constant';
import _util from '@/utils/_util';

type SettingsFormData = Omit<DefaultValue, 'selectedLlm'> & {
  selectedLlm: {
    service: string;
    model: string;
  };
};

const emptyDefaultValue: SettingsFormData = {
  promptBuilder: { ..._constant.emptyPromptBuilder },
  generationProfiles: normalizeGenerationProfileConfig(null),
  apiKey: { ..._constant.emptyApiKey },
  selectedLlm: { ..._constant.defaultSelectedLlm },
};

export default function SettingPage() {
  const { fetcher } = useFetcher();

  const [formData, setFormData] = useState<SettingsFormData>(emptyDefaultValue);
  const [togetherModels, setTogetherModels] = useState<AiModelOption[]>([]);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelLoadError, setModelLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setFetchLoading(true);
        const data = await fetcher<DefaultValue>('/api/settings', {
          errorMessage: 'Failed to fetch settings',
        });
        setFormData({
          promptBuilder: _util.normalizePromptBuilderConfig(data.promptBuilder),
          generationProfiles: normalizeGenerationProfileConfig(data.generationProfiles),
          apiKey: _util.normalizeApiKeyConfig(data.apiKey),
          selectedLlm: {
            service: data.selectedLlm?.service || _constant.defaultSelectedLlm.service,
            model: data.selectedLlm?.model || _constant.defaultSelectedLlm.model,
          },
        });
      } catch {
      } finally {
        setFetchLoading(false);
      }
    };

    fetchSettings();
  }, [fetcher]);

  useEffect(() => {
    if (formData.selectedLlm.service !== 'together') {
      setModelLoadError(null);
      return;
    }

    const apiKey = _util.toInputString(formData.apiKey.together);

    let canceled = false;
    const fetchModels = async () => {
      try {
        setModelLoading(true);
        setModelLoadError(null);
        const data = await fetcher<{ models: AiModelOption[] }>('/api/ai/models/together', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(apiKey ? { apiKey } : {}),
          silent: true,
        });
        if (!canceled) {
          setTogetherModels(data.models);
          if (data.models.length === 0) {
            setModelLoadError('No Together chat models were returned.');
          }
        }
      } catch (err) {
        if (!canceled) {
          setTogetherModels([]);
          setModelLoadError(err instanceof Error ? err.message : 'Failed to load Together models.');
        }
      } finally {
        if (!canceled) {
          setModelLoading(false);
        }
      }
    };

    fetchModels();
    return () => {
      canceled = true;
    };
  }, [formData.selectedLlm.service, formData.apiKey.together, fetcher]);

  useEffect(() => {
    if (
      formData.selectedLlm.service === 'together' &&
      !formData.selectedLlm.model &&
      togetherModels.length > 0
    ) {
      setFormData((prev) => ({
        ...prev,
        selectedLlm: {
          ...prev.selectedLlm,
          model: togetherModels[0].id,
        },
      }));
    }
  }, [formData.selectedLlm.service, formData.selectedLlm.model, togetherModels]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSaveMessage(null);

    try {
      await fetcher('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          promptBuilder: _util.normalizePromptBuilderConfig(formData.promptBuilder),
          generationProfiles: normalizeGenerationProfileConfig(formData.generationProfiles),
          apiKey: _util.normalizeApiKeyConfig(formData.apiKey),
        }),
        errorMessage: 'Failed to update settings',
      });
      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleSelectedServiceChange = (service: string) => {
    const serviceConfig = _constant.llmServices[service as keyof typeof _constant.llmServices];

    setFormData((prev) => ({
      ...prev,
      selectedLlm: {
        ...prev.selectedLlm,
        service,
        model: service === 'together' ? '' : serviceConfig?.models[0] ?? '',
      },
    }));
  };

  const handleSelectedModelChange = (model: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedLlm: {
        ...prev.selectedLlm,
        model,
      },
    }));
  };

  const handlePromptBuilderChange = (field: keyof PromptBuilderConfig, value: string) => {
    setFormData((prev) => ({
      ...prev,
      promptBuilder: {
        ...prev.promptBuilder,
        [field]: value,
      },
    }));
  };

  const handleApiKeyChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      apiKey: {
        ...prev.apiKey,
        [field]: value,
      },
    }));
  };

  if (fetchLoading) {
    return (
      <div className="p-8 max-w-3xl">
        <h1 className="text-2xl font-bold mb-4 text-secondary">Default Settings</h1>
        <div>Loading settings...</div>
      </div>
    );
  }

  const isSupportedService = !formData.selectedLlm.service || formData.selectedLlm.service in _constant.llmServices;
  const togetherModelUnavailable =
    formData.selectedLlm.service === 'together' &&
    Boolean(formData.selectedLlm.model) &&
    togetherModels.length > 0 &&
    !togetherModels.some((model) => model.id === formData.selectedLlm.model);
  const llmError = !formData.selectedLlm.service
    ? 'Select a provider.'
    : !isSupportedService
    ? 'Mistral is no longer supported; choose Together AI or OpenAI.'
    : togetherModelUnavailable
      ? 'The selected Together model is unavailable; choose a model from the fetched list.'
      : formData.selectedLlm.service === 'together' && !formData.selectedLlm.model && !modelLoading
        ? 'Select a Together AI model.'
        : null;
  const saveDisabled = loading || modelLoading || Boolean(llmError) || Boolean(modelLoadError);

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-4 text-secondary">Settings</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <PromptEditorSection
          promptBuilder={formData.promptBuilder}
          onPromptBuilderChange={handlePromptBuilderChange}
          promptBuilderLegend="Default Prompt Builder"
        />

        <GenerationProfilesSection
          generationProfiles={formData.generationProfiles}
          onChange={(generationProfiles) => setFormData((prev) => ({ ...prev, generationProfiles }))}
        />

        <AiSettingsSection
          selectedService={formData.selectedLlm.service}
          selectedModel={formData.selectedLlm.model}
          apiKey={formData.apiKey}
          onServiceChange={handleSelectedServiceChange}
          onModelChange={handleSelectedModelChange}
          onApiKeyChange={handleApiKeyChange}
          togetherModels={togetherModels}
          modelLoading={modelLoading}
          modelLoadError={modelLoadError}
          llmError={llmError}
          variant="page"
        />

        <div className="flex gap-4 items-center">
          <Button type="submit" disabled={saveDisabled} variant="primary">
            {loading ? 'Saving...' : 'Save Settings'}
          </Button>
          {saveMessage && (
            <span className="text-green-500 text-sm">{saveMessage}</span>
          )}
        </div>
      </form>
    </div>
  );
}
