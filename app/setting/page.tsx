'use client';

import { useState, useEffect } from 'react';
import { AiModelOption, ApiKeyConfig, DefaultValue, LLMService, PromptBuilderConfig } from '@/types';
import { TtsSettingsSection } from '@/components/TtsSettingsSection';
import { resolveTtsConfig } from '@/lib/ttsConfig';
import { AiSettingsSection } from '@/components/AiSettingsSection';
import { useAiModelCatalog } from '@/components/AiModelCatalogProvider';
import { useFetcher } from '@/components/FetcherProvider';
import { Button } from '@/components/Button';
import { PromptEditorSection } from '@/components/PromptEditorSection';
import { GenerationProfilesSection } from '@/components/GenerationProfilesSection';
import { normalizeGenerationProfileConfig } from '@/lib/generationProfiles';
import { getUnsupportedLlmMessage, isSupportedLlmService, supportedLlmServices } from '@/lib/llmSettings';
import _constant from '@/utils/_constant';
import _util from '@/utils/_util';

type SettingsFormData = Omit<DefaultValue, 'selectedLlm' | 'modelPayloads'> & {
  selectedLlm: {
    service: string;
    model: string;
  };
};

const emptyModels: AiModelOption[] = [];

const emptyDefaultValue: SettingsFormData = {
  selectedTts: resolveTtsConfig(null),
  autocomplete: null,
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
  const [dirtyApiKeys, setDirtyApiKeys] = useState<Partial<Record<LLMService, boolean>>>({});
  const [refuselessKeyConfigured, setRefuselessKeyConfigured] = useState(false);
  const [removeRefuselessKey, setRemoveRefuselessKey] = useState(false);
  const [ttsKeysDirty, setTtsKeysDirty] = useState(false);
  const [savingMode, setSavingMode] = useState<'save' | 'test' | null>(null);
  const loading = savingMode !== null;
  const [fetchLoading, setFetchLoading] = useState(true);
  const [saveMessage, setSaveMessage] = useState<{ text: string; error?: boolean } | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setFetchLoading(true);
        const data = await fetcher<DefaultValue & { refuselessKeyConfigured?: boolean }>('/api/settings', {
          errorMessage: 'Failed to fetch settings',
        });
        const apiKey = _util.normalizeApiKeyConfig(data.apiKey);
        setFormData({
          selectedTts: resolveTtsConfig(data.selectedTts),
          autocomplete: data.autocomplete ?? null,
          promptBuilder: _util.normalizePromptBuilderConfig(data.promptBuilder),
          generationProfiles: normalizeGenerationProfileConfig(data.generationProfiles),
          apiKey,
          selectedLlm: {
            service: data.selectedLlm?.service || _constant.defaultSelectedLlm.service,
            model: data.selectedLlm?.model || _constant.defaultSelectedLlm.model,
          },
        });
        setModelKeys(apiKey);
        setRefuselessKeyConfigured(Boolean(data.refuselessKeyConfigured));
        for (const service of supportedLlmServices) void loadModels(service, apiKey[service], false, 'defaults');
      } catch {
      } finally {
        setFetchLoading(false);
      }
    };

    fetchSettings();
  }, [fetcher, loadModels]);

  const selectedService = formData.selectedLlm.service;
  const isSupportedService = isSupportedLlmService(selectedService);
  const catalog = isSupportedService
    ? getEntry(selectedService, modelKeys[selectedService], 'defaults')
    : null;
  const models = catalog?.models ?? emptyModels;
  const modelLoading = catalog?.loading ?? false;
  const modelLoadError = catalog?.error ?? null;
  const removingSelectedKey = selectedService === 'refuseless' && removeRefuselessKey;

  useEffect(() => {
    if (
      isSupportedService && selectedService !== 'openAi' &&
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
  }, [isSupportedService, selectedService, formData.selectedLlm.model, models]);

  const saveSettings = async (testModels = false) => {
    setSavingMode(testModels ? 'test' : 'save');
    setSaveMessage(null);

    try {
      const { refuseless, ...apiKey } = _util.normalizeApiKeyConfig(formData.apiKey);
      const newRefuselessKey = removeRefuselessKey ? null : _util.toIdentifierString(refuseless) || undefined;
      await fetcher('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          promptBuilder: _util.normalizePromptBuilderConfig(formData.promptBuilder),
          generationProfiles: normalizeGenerationProfileConfig(formData.generationProfiles),
          apiKey: { ...apiKey, refuseless: newRefuselessKey },
          ...(testModels ? { testModels } : {}),
        }),
        errorMessage: 'Failed to update settings',
        silent: testModels,
      });
      if (newRefuselessKey !== undefined) {
        setRefuselessKeyConfigured(Boolean(newRefuselessKey));
        setRemoveRefuselessKey(false);
        setFormData(prev => ({ ...prev, apiKey: { ...prev.apiKey, refuseless: '' } }));
        setModelKeys(prev => ({ ...prev, refuseless: '' }));
        void loadModels('refuseless', '', true, 'defaults');
      }
      setTtsKeysDirty(false);
      window.dispatchEvent(new Event('aistory:settings'));
      setSaveMessage({ text: testModels ? 'Model checks passed. Settings saved.' : 'Settings saved.' });
    } catch (error) {
      if (testModels) setSaveMessage({ text: error instanceof Error ? error.message : 'Model check failed.', error: true });
    } finally {
      setSavingMode(null);
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

  const handleApiKeyChange = (field: LLMService, value: string) => {
    if (field === 'refuseless') setRemoveRefuselessKey(false);
    else setTtsKeysDirty(true);
    setFormData((prev) => ({
      ...prev,
      apiKey: {
        ...prev.apiKey,
        [field]: value,
      },
    }));
    setDirtyApiKeys((prev) => ({ ...prev, [field]: true }));
  };

  const handleApiKeyBlur = (service: LLMService) => {
    if (!dirtyApiKeys[service]) return;
    const apiKey = _util.toInputString(formData.apiKey[service]);
    setDirtyApiKeys((prev) => ({ ...prev, [service]: false }));
    setModelKeys((prev) => ({ ...prev, [service]: apiKey }));
    void loadModels(service, apiKey, true, 'defaults');
  };

  if (fetchLoading) {
    return (
      <div className="p-8 max-w-3xl">
        <h1 className="text-2xl font-bold mb-4 text-secondary">Default Settings</h1>
        <div>Loading settings...</div>
      </div>
    );
  }

  const modelUnavailable =
    isSupportedService && !removingSelectedKey &&
    Boolean(formData.selectedLlm.model) &&
    models.length > 0 &&
    !models.some((model) => model.id === formData.selectedLlm.model);
  const llmError = !formData.selectedLlm.service
    ? 'Select a provider.'
    : !isSupportedService
    ? getUnsupportedLlmMessage(selectedService)
    : modelUnavailable
      ? 'The selected model is unavailable; choose a model from the fetched list.'
      : !formData.selectedLlm.model && (!modelLoading || removingSelectedKey)
        ? 'Select a model.'
        : null;
  const saveDisabled = loading || Boolean(llmError) || (!removingSelectedKey && (modelLoading || Boolean(modelLoadError)));

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-4 text-secondary">Settings</h1>

      <form onSubmit={event => { event.preventDefault(); void saveSettings(); }} className="space-y-4">
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
          refuselessKeyConfigured={refuselessKeyConfigured}
          removingRefuselessKey={removeRefuselessKey}
          onToggleRefuselessKeyRemoval={() => {
            handleApiKeyChange('refuseless', '');
            setRemoveRefuselessKey(!removeRefuselessKey);
          }}
          models={models}
          modelLoading={modelLoading}
          modelLoadError={modelLoadError}
          llmError={llmError}
          autocomplete={{
            value: formData.autocomplete,
            onChange: autocomplete => setFormData(previous => ({ ...previous, autocomplete })),
            modelKeys,
            scope: 'defaults',
            disabled: loading,
          }}
          variant="page"
        />

        <TtsSettingsSection scope="defaults" value={formData.selectedTts ?? resolveTtsConfig(null)} onChange={(selectedTts) => setFormData(previous => ({ ...previous, selectedTts }))} credentialsDirty={ttsKeysDirty} />

        <div className="flex gap-4 items-center">
          <Button type="submit" disabled={saveDisabled} variant="primary">
            {savingMode === 'save' ? 'Saving...' : 'Save Settings'}
          </Button>
          <Button type="button" disabled={saveDisabled} variant="outline" onClick={() => void saveSettings(true)}>
            {savingMode === 'test' ? 'Testing...' : 'Save & test'}
          </Button>
          {saveMessage && (
            <span role="status" className={`text-sm ${saveMessage.error ? 'text-red-500' : 'text-green-500'}`}>{saveMessage.text}</span>
          )}
        </div>
      </form>
    </div>
  );
}
