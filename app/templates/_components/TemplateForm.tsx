'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Template } from '@/types';

interface TemplateFormProps {
  templateId?: string; // If provided, we're in edit mode
}

const emptyTemplate: Omit<Template, 'templateId'> & { templateId: string } = {
  templateId: '',
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

  const [formData, setFormData] = useState(emptyTemplate);
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
      <h1>{isEditMode ? 'Edit Template' : 'Create New Template'}</h1>

      {error && <div style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.25rem' }}>
            Template ID:
          </label>
          <input
            type="text"
            value={formData.templateId}
            onChange={(e) => handleInputChange('templateId', e.target.value)}
            disabled={isEditMode}
            required
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.25rem' }}>
            Name:
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            required
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>

        <fieldset style={{ marginBottom: '1rem', padding: '1rem' }}>
          <legend>Prompts</legend>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem' }}>
              Narrator:
            </label>
            <textarea
              value={formData.prompt.narrator || ''}
              onChange={(e) => handlePromptChange('narrator', e.target.value)}
              rows={4}
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem' }}>
              Input Tag:
            </label>
            <input
              type="text"
              value={formData.prompt.inputTag || ''}
              onChange={(e) => handlePromptChange('inputTag', e.target.value)}
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem' }}>
              Summarizer:
            </label>
            <textarea
              value={formData.prompt.summarizer || ''}
              onChange={(e) => handlePromptChange('summarizer', e.target.value)}
              rows={4}
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem' }}>
              Summarizer End State:
            </label>
            <textarea
              value={formData.prompt.summarizerEndState || ''}
              onChange={(e) => handlePromptChange('summarizerEndState', e.target.value)}
              rows={4}
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>
        </fieldset>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.25rem' }}>
            Story Background:
          </label>
          <textarea
            value={formData.storyBackground}
            onChange={(e) => handleInputChange('storyBackground', e.target.value)}
            rows={6}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button type="submit" disabled={loading}>
            {loading ? 'Saving...' : isEditMode ? 'Update Template' : 'Create Template'}
          </button>
          <button type="button" onClick={() => router.push('/templates')}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
