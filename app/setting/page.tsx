'use client';

import { useState, useEffect } from 'react';
import { DefaultValue } from '@/types';
import { useFetcher } from '@/components/FetcherProvider';
import { Button } from '@/components/Button';
import { FormField } from '@/components/FormField';
import { Input } from '@/components/Input';
import { Textarea } from '@/components/Textarea';

const emptyDefaultValue: DefaultValue = {
  prompt: {
    narrator: '',
    inputTag: '',
    summarizer: '',
    summarizerEndState: '',
  },
  apiKey: {
    mistral: '',
    together: '',
    openAi: '',
  },
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
          apiKey: {
            mistral: data.apiKey?.mistral || '',
            together: data.apiKey?.together || '',
            openAi: data.apiKey?.openAi || '',
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

  const handlePromptChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      prompt: {
        ...prev.prompt,
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
        <h1 className="text-2xl font-bold mb-4 text-secondary">Settings</h1>
        <div>Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-4 text-secondary">Settings</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <fieldset className="mb-4 p-4 border border-border rounded bg-card/50">
          <legend className="font-semibold text-secondary px-2">Default Prompts</legend>

          <FormField label="Narrator:">
            <Textarea
              value={formData.prompt.narrator || ''}
              onChange={(e) => handlePromptChange('narrator', e.target.value)}
              rows={4}
            />
          </FormField>

          <FormField label="Input Tag:">
            <Input
              type="text"
              value={formData.prompt.inputTag || ''}
              onChange={(e) => handlePromptChange('inputTag', e.target.value)}
            />
          </FormField>

          <FormField label="Summarizer:">
            <Textarea
              value={formData.prompt.summarizer || ''}
              onChange={(e) => handlePromptChange('summarizer', e.target.value)}
              rows={4}
            />
          </FormField>

          <FormField label="Summarizer End State:">
            <Textarea
              value={formData.prompt.summarizerEndState || ''}
              onChange={(e) => handlePromptChange('summarizerEndState', e.target.value)}
              rows={4}
            />
          </FormField>
        </fieldset>

        <fieldset className="mb-4 p-4 border border-border rounded bg-card/50">
          <legend className="font-semibold text-secondary px-2">API Keys</legend>

          <FormField label="Mistral API Key:">
            <Input
              type="password"
              value={formData.apiKey.mistral || ''}
              onChange={(e) => handleApiKeyChange('mistral', e.target.value)}
              placeholder="Enter Mistral API key"
            />
          </FormField>

          <FormField label="Together API Key:">
            <Input
              type="password"
              value={formData.apiKey.together || ''}
              onChange={(e) => handleApiKeyChange('together', e.target.value)}
              placeholder="Enter Together API key"
            />
          </FormField>

          <FormField label="OpenAI API Key:">
            <Input
              type="password"
              value={formData.apiKey.openAi || ''}
              onChange={(e) => handleApiKeyChange('openAi', e.target.value)}
              placeholder="Enter OpenAI API key"
            />
          </FormField>
        </fieldset>

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
