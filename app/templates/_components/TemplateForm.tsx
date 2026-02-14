'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Template } from '@/types';
import { useFetcher } from '@/components/FetcherProvider';
import { Button } from '@/components/Button';
import { FormField } from '@/components/FormField';
import { Input } from '@/components/Input';
import { Textarea } from '@/components/Textarea';
import { TemplateSafeModel } from '@/types/extendedTypes';

interface TemplateFormProps {
  templateId?: string; // If provided, we're in edit mode
}

const emptyTemplate: TemplateSafeModel = {
  templateId: null,
  name: '',
  prompt: {
    narrator: '',
    inputTag: '',
    summarizer: '',
    summarizerEndState: '',
  },
  storyBackground: '',
  imageUrl: null,
};

export default function TemplateForm({ templateId }: TemplateFormProps) {
  const router = useRouter();
  const { fetcher } = useFetcher();
  const isEditMode = Boolean(templateId);

  const [formData, setFormData] = useState<TemplateSafeModel>(emptyTemplate);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(isEditMode);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const uploadData = new FormData();
      uploadData.append('file', file);

      const res = await fetcher<{ imageUrl: string }>('/api/templates/upload', {
        method: 'POST',
        body: uploadData,
        errorMessage: 'Failed to upload image',
      });

      setFormData((prev) => ({ ...prev, imageUrl: res.imageUrl }));
    } catch {
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = () => {
    setFormData((prev) => ({ ...prev, imageUrl: null }));
  };

  useEffect(() => {
    const fetchTemplate = async () => {
      try {
        setFetchLoading(true);
        const data = await fetcher<Template>(`/api/templates/${templateId}`, {
          errorMessage: 'Failed to fetch template',
        });
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
          imageUrl: data.imageUrl ?? null,
        });
      } catch {
      } finally {
        setFetchLoading(false);
      }
    };

    if (isEditMode && templateId) {
      fetchTemplate();
    }
  }, [isEditMode, templateId, fetcher]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = isEditMode ? `/api/templates/${templateId}` : '/api/templates';
      const method = isEditMode ? 'PUT' : 'POST';

      await fetcher(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
        errorMessage: `Failed to ${isEditMode ? 'update' : 'create'} template`,
      });

      router.push('/templates');
    } catch {
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

      <form onSubmit={handleSubmit} className="space-y-4">
        {isEditMode && (
          <FormField label="Template ID:" labelClassName="text-muted-foreground">
            <Input
              type="text"
              value={formData.templateId || ''}
              disabled
              className="bg-muted text-muted-foreground"
            />
          </FormField>
        )}

        <FormField label="Name:">
          <Input
            type="text"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            required
          />
        </FormField>

        <fieldset className="mb-4 p-4 border border-border rounded bg-card/50">
          <legend className="font-semibold text-secondary px-2">Prompts</legend>

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

        <FormField label="Story Background:">
          <Textarea
            value={formData.storyBackground}
            onChange={(e) => handleInputChange('storyBackground', e.target.value)}
            rows={6}
          />
        </FormField>

        <FormField label="Image:">
          <div className="space-y-3">
            {formData.imageUrl && (
              <div className="relative inline-block">
                <Image
                  src={formData.imageUrl}
                  alt="Template"
                  width={320}
                  height={192}
                  className="max-w-xs max-h-48 rounded border border-border object-cover"
                  unoptimized
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm hover:opacity-80"
                >
                  ×
                </button>
              </div>
            )}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleImageUpload}
                disabled={uploading}
                className="text-sm text-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:opacity-80 file:cursor-pointer"
              />
              {uploading && <span className="text-sm text-muted-foreground ml-2">Uploading...</span>}
            </div>
          </div>
        </FormField>

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
