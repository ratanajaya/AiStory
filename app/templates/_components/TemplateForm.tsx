'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Template } from '@/types';

interface TemplateFormProps {
  templateId?: string; // If provided, we're in edit mode
}

const emptyTemplate: Template = {
  templateId: null,
  name: '',
  prompt: {
    narrator: '',
    inputTag: '',
    summarizer: '',
    summarizerEndState: '',
  },
  storyBackground: '',
};

export default function TemplateForm({ templateId }: TemplateFormProps) {
  const router = useRouter();
  const isEditMode = Boolean(templateId);

  const [formData, setFormData] = useState<Template>(emptyTemplate);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(isEditMode);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTemplate = async () => {
      try {
        setFetchLoading(true);
        const response = await fetch(`/api/templates/${templateId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch template');
        }
        const data = await response.json();
        setFormData({
          templateId: data.templateId,
          name: data.name,
          prompt: {
            narrator: data.prompt?.narrator || '',
            inputTag: data.prompt?.inputTag || '',
            summarizer: data.prompt?.summarizer || '',
            summarizerEndState: data.prompt?.summarizerEndState || '',
          },
          storyBackground: data.storyBackground || '',
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setFetchLoading(false);
      }
    };

    if (isEditMode && templateId) {
      fetchTemplate();
    }
  }, [isEditMode, templateId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const url = isEditMode ? `/api/templates/${templateId}` : '/api/templates';
      const method = isEditMode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${isEditMode ? 'update' : 'create'} template`);
      }

      router.push('/templates');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handlePromptChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      prompt: {
        ...prev.prompt,
        [field]: value,
      },
    }));
  };

  if (fetchLoading) {
    return <div>Loading template...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">{isEditMode ? 'Edit Template' : 'Create New Template'}</h1>

      {error && <div className="text-red-500 mb-4">{error}</div>}

      <form onSubmit={handleSubmit}>
        {isEditMode && (
          <div className="mb-4">
            <label className="block mb-1">
              Template ID:
            </label>
            <input
              type="text"
              value={formData.templateId || ''}
              disabled
              className="w-full p-2 bg-gray-100 border rounded"
            />
          </div>
        )}

        <div className="mb-4">
          <label className="block mb-1">
            Name:
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            required
            className="w-full p-2 border rounded"
          />
        </div>

        <fieldset className="mb-4 p-4 border rounded">
          <legend className="font-semibold">Prompts</legend>

          <div className="mb-4">
            <label className="block mb-1">
              Narrator:
            </label>
            <textarea
              value={formData.prompt.narrator || ''}
              onChange={(e) => handlePromptChange('narrator', e.target.value)}
              rows={4}
              className="w-full p-2 border rounded"
            />
          </div>

          <div className="mb-4">
            <label className="block mb-1">
              Input Tag:
            </label>
            <input
              type="text"
              value={formData.prompt.inputTag || ''}
              onChange={(e) => handlePromptChange('inputTag', e.target.value)}
              className="w-full p-2 border rounded"
            />
          </div>

          <div className="mb-4">
            <label className="block mb-1">
              Summarizer:
            </label>
            <textarea
              value={formData.prompt.summarizer || ''}
              onChange={(e) => handlePromptChange('summarizer', e.target.value)}
              rows={4}
              className="w-full p-2 border rounded"
            />
          </div>

          <div className="mb-4">
            <label className="block mb-1">
              Summarizer End State:
            </label>
            <textarea
              value={formData.prompt.summarizerEndState || ''}
              onChange={(e) => handlePromptChange('summarizerEndState', e.target.value)}
              rows={4}
              className="w-full p-2 border rounded"
            />
          </div>
        </fieldset>

        <div className="mb-4">
          <label className="block mb-1">
            Story Background:
          </label>
          <textarea
            value={formData.storyBackground}
            onChange={(e) => handleInputChange('storyBackground', e.target.value)}
            rows={6}
            className="w-full p-2 border rounded"
          />
        </div>

        <div className="flex gap-4">
          <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50">
            {loading ? 'Saving...' : isEditMode ? 'Update Template' : 'Create Template'}
          </button>
          <button type="button" onClick={() => router.push('/templates')} className="px-4 py-2 border rounded hover:bg-gray-100">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
