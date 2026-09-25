'use client';

import { useState, useEffect } from 'react';
import { AiModelOption, ApiKeyConfig, DefaultValue, LLMService, PromptBuilderConfig } from '@/types';
import { AiSettingsSection } from '@/components/AiSettingsSection';
import { useAiModelCatalog } from '@/components/AiModelCatalogProvider';
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

const emptyModels: AiModelOption[] = [];

const emptyDefaultValue: SettingsFormData = {
  promptBuilder: { ..._constant.emptyPromptBuilder },
  generationProfiles: normalizeGenerationProfileConfig(null),
  apiKey: { ..._constant.emptyApiKey },
  selectedLlm: { ..._constant.defaultSelectedLlm },
};

export default function SettingPage() {
  const { fetcher } = useFetcher();
  const { getEntry, loadModels } = useAiModelCatalog();

  const [formData, setFormData] = useState<SettingsFormData>(emptyDefaultValue);
  const [modelKeys, setModelKeys] = useState<ApiKeyConfig>({ ..._constant.emptyApiKey });
  const [dirtyApiKeys, setDirtyApiKeys] = useState<Record<LLMService, boolean>>({ together: false, openAi: false });
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
        const apiKey = _util.normalizeApiKeyConfig(data.apiKey);
        setFormData({
          promptBuilder: _util.normalizePromptBuilderConfig(data.promptBuilder),
          generationProfiles: normalizeGenerationProfileConfig(data.generationProfiles),
          apiKey,
          selectedLlm: {
            service: data.selectedLlm?.service || _constant.defaultSelectedLlm.service,
            model: data.selectedLlm?.model || _constant.defaultSelectedLlm.model,
          },
        });
        setModelKeys(apiKey);
        void loadModels('together', apiKey.together);
        void loadModels('openAi', apiKey.openAi);
      } catch {
      } finally {
        setFetchLoading(false);
      }
    };

    fetchSettings();
  }, [fetcher, loadModels]);

  const catalog = formData.selectedLlm.service === 'together' || formData.selectedLlm.service === 'openAi'
    ? getEntry(formData.selectedLlm.service, modelKeys[formData.selectedLlm.service])
    : null;
  const models = catalog?.models ?? emptyModels;
  const modelLoading = catalog?.loading ?? false;
  const modelLoadError = catalog?.error ?? null;

  useEffect(() => {
    if (
      formData.selectedLlm.service === 'together' &&
      !formData.selectedLlm.model &&
      models.length > 0
    ) {
      setFormData((prev) => ({
        ...prev,
        selectedLlm: {
          ...prev.selectedLlm,
          model: models[0].id,
        },
      }));
    }
  }, [formData.selectedLlm.service, formData.selectedLlm.model, models]);

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
    setFormData((prev) => ({
      ...prev,
      selectedLlm: {
        ...prev.selectedLlm,
        service,
        model: service === 'openAi' ? _constant.defaultSelectedLlm.model : '',
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
    if (field === 'together' || field === 'openAi') {
      setDirtyApiKeys((prev) => ({ ...prev, [field]: true }));
    }
  };

  const handleApiKeyBlur = (service: LLMService) => {
    if (!dirtyApiKeys[service]) return;
    const apiKey = _util.toInputString(formData.apiKey[service]);
    setDirtyApiKeys((prev) => ({ ...prev, [service]: false }));
    setModelKeys((prev) => ({ ...prev, [service]: apiKey }));
    void loadModels(service, apiKey, true);
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
  const modelUnavailable =
    (formData.selectedLlm.service === 'together' || formData.selectedLlm.service === 'openAi') &&
    Boolean(formData.selectedLlm.model) &&
    models.length > 0 &&
    !models.some((model) => model.id === formData.selectedLlm.model);
  const llmError = !formData.selectedLlm.service
    ? 'Select a provider.'
    : !isSupportedService
    ? 'Mistral is no longer supported; choose Together AI or OpenAI.'
    : modelUnavailable
      ? 'The selected model is unavailable; choose a model from the fetched list.'
      : (formData.selectedLlm.service === 'together' || formData.selectedLlm.service === 'openAi') && !formData.selectedLlm.model && !modelLoading
        ? 'Select a model.'
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
          onApiKeyBlur={handleApiKeyBlur}
          models={models}
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
