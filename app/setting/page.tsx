'use client';

import { useState, useEffect } from 'react';
import { DefaultValue, LLMService, PromptBuilderConfig, PromptConfig } from '@/types';
import { AiSettingsSection } from '@/components/AiSettingsSection';
import { useFetcher } from '@/components/FetcherProvider';
import { Button } from '@/components/Button';
import { PromptEditorSection } from '@/components/PromptEditorSection';
import _constant from '@/utils/_constant';

const emptyDefaultValue: DefaultValue = {
  prompt: { ..._constant.emptyPrompt },
  promptBuilder: { ..._constant.emptyPromptBuilder },
  apiKey: { ..._constant.emptyApiKey },
  selectedLlm: { ..._constant.defaultSelectedLlm },
};

export default function SettingPage() {
  const { fetcher } = useFetcher();

  const [formData, setFormData] = useState<DefaultValue>(emptyDefaultValue);
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
          prompt: {
            narrator: data.prompt?.narrator || '',
            inputTag: data.prompt?.inputTag || '',
            summarizer: data.prompt?.summarizer || '',
            summarizerEndState: data.prompt?.summarizerEndState || '',
          },
          promptBuilder: {
            narration1: data.promptBuilder?.narration1 || '',
            narration2: data.promptBuilder?.narration2 || '',
            enhancer: data.promptBuilder?.enhancer || '',
          },
          apiKey: {
            mistral: data.apiKey?.mistral || '',
            together: data.apiKey?.together || '',
            openAi: data.apiKey?.openAi || '',
          },
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
        body: JSON.stringify(formData),
        errorMessage: 'Failed to update settings',
      });
      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handlePromptChange = (field: keyof PromptConfig, value: string) => {
    setFormData((prev) => ({
      ...prev,
      prompt: {
        ...prev.prompt,
        [field]: value || null,
      },
    }));
  };

  const handleSelectedServiceChange = (service: string) => {
    const nextService = (service || _constant.defaultSelectedLlm.service) as LLMService;

    setFormData((prev) => ({
      ...prev,
      selectedLlm: {
        ...prev.selectedLlm,
        service: nextService,
        model: service
          ? prev.selectedLlm.model
          : _constant.defaultSelectedLlm.model,
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
        [field]: value || null,
      },
    }));
  };

  const handleApiKeyChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      apiKey: {
        ...prev.apiKey,
        [field]: value || null,
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

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-4 text-secondary">Settings</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <PromptEditorSection
          prompt={formData.prompt}
          promptBuilder={formData.promptBuilder}
          onPromptChange={handlePromptChange}
          onPromptBuilderChange={handlePromptBuilderChange}
          promptLegend="Default Prompts"
          promptBuilderLegend="Default Prompt Builder"
        />

        <AiSettingsSection
          selectedService={formData.selectedLlm.service}
          selectedModel={formData.selectedLlm.model}
          apiKey={formData.apiKey}
          onServiceChange={handleSelectedServiceChange}
          onModelChange={handleSelectedModelChange}
          onApiKeyChange={handleApiKeyChange}
          variant="page"
        />

        <div className="flex gap-4 items-center">
          <Button type="submit" disabled={loading} variant="primary">
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
