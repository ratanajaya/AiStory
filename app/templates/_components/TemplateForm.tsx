'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Template } from '@/types';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Textarea } from '@/components/Textarea';

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
      <h1 className="text-2xl font-bold mb-4 text-secondary">{isEditMode ? 'Edit Template' : 'Create New Template'}</h1>

      {error && <div className="text-red-500 mb-4">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        {isEditMode && (
          <div className="mb-4">
            <label className="block mb-1 text-muted-foreground">
              Template ID:
            </label>
            <Input
              type="text"
              value={formData.templateId || ''}
              disabled
              className="bg-muted text-muted-foreground"
            />
          </div>
        )}

        <div className="mb-4">
          <label className="block mb-1 text-foreground">
            Name:
          </label>
          <Input
            type="text"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            required
          />
        </div>

        <fieldset className="mb-4 p-4 border border-border rounded bg-card/50">
          <legend className="font-semibold text-secondary px-2">Prompts</legend>

          <div className="mb-4">
            <label className="block mb-1 text-foreground">
              Narrator:
            </label>
            <Textarea
              value={formData.prompt.narrator || ''}
              onChange={(e) => handlePromptChange('narrator', e.target.value)}
              rows={4}
            />
          </div>

          <div className="mb-4">
            <label className="block mb-1 text-foreground">
              Input Tag:
            </label>
            <Input
              type="text"
              value={formData.prompt.inputTag || ''}
              onChange={(e) => handlePromptChange('inputTag', e.target.value)}
            />
          </div>

          <div className="mb-4">
            <label className="block mb-1 text-foreground">
              Summarizer:
            </label>
            <Textarea
              value={formData.prompt.summarizer || ''}
              onChange={(e) => handlePromptChange('summarizer', e.target.value)}
              rows={4}
            />
          </div>

          <div className="mb-4">
            <label className="block mb-1 text-foreground">
              Summarizer End State:
            </label>
            <Textarea
              value={formData.prompt.summarizerEndState || ''}
              onChange={(e) => handlePromptChange('summarizerEndState', e.target.value)}
              rows={4}
            />
          </div>
        </fieldset>

        <div className="mb-4">
          <label className="block mb-1 text-foreground">
            Story Background:
          </label>
          <Textarea
            value={formData.storyBackground}
            onChange={(e) => handleInputChange('storyBackground', e.target.value)}
            rows={6}
          />
        </div>

        <div className="flex gap-4">
          <Button type="submit" disabled={loading} variant="primary">
            {loading ? 'Saving...' : isEditMode ? 'Update Template' : 'Create Template'}
          </Button>
          <Button type="button" onClick={() => router.push('/templates')} variant="outline">
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
