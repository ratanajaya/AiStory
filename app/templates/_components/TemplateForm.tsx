'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { BeforeSignInDetail } from '@/lib/guestSignInClient';
import { useAlert } from '@/components/AlertBox';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { PromptBuilderConfig, Template } from '@/types';
import { useFetcher } from '@/components/FetcherProvider';
import { Button } from '@/components/Button';
import { FormField } from '@/components/FormField';
import { Input } from '@/components/Input';
import { PromptEditorSection } from '@/components/PromptEditorSection';
import { Textarea } from '@/components/Textarea';
import { TemplateSafeModel } from '@/types/extendedTypes';
import _constant from '@/utils/_constant';
import _util from '@/utils/_util';

interface TemplateFormProps {
  templateId?: string; // If provided, we're in edit mode
}

const emptyTemplate: TemplateSafeModel = {
  templateId: null,
  name: '',
  promptBuilder: { ..._constant.emptyPromptBuilder },
  storyBackground: '',
  writingStyle: '',
  imageUrl: null,
  isPublic: false,
};

export default function TemplateForm({ templateId }: TemplateFormProps) {
  const router = useRouter();
  const { showAlert } = useAlert();
  const dirty = useRef(false);
  const savedId = useRef(templateId);
  const { fetcher } = useFetcher();
  const isEditMode = Boolean(templateId);

  const [formData, setFormData] = useState<TemplateSafeModel>(emptyTemplate);
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => { fetcher<{ isAdmin: boolean }>('/api/viewer', { silent: true }).then((viewer) => setIsAdmin(viewer.isAdmin)).catch(() => {}); }, [fetcher]);
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

      dirty.current = true;
      setFormData((prev) => ({ ...prev, imageUrl: res.imageUrl }));
    } catch {
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = () => {
    dirty.current = true;
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
          name: _util.toInputString(data.name),
          promptBuilder: _util.normalizePromptBuilderConfig(data.promptBuilder),
          storyBackground: _util.toInputString(data.storyBackground),
          writingStyle: _util.toInputString(data.writingStyle),
          imageUrl: data.imageUrl ?? null,
          isPublic: data.isPublic ?? false,
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

  const saveTemplate = useCallback(async () => {
    setLoading(true);
    try {
      const id = savedId.current;
      const saved = await fetcher<Template>(id ? `/api/templates/${id}` : '/api/templates', {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formData.name, promptBuilder: formData.promptBuilder, storyBackground: formData.storyBackground, writingStyle: formData.writingStyle, imageUrl: formData.imageUrl, ...(isAdmin ? { isPublic: formData.isPublic === true } : {}) }),
        errorMessage: 'Failed to save template',
      });
      savedId.current = saved.templateId ?? undefined;
      dirty.current = false;
      return saved.templateId;
    } finally { setLoading(false); }
  }, [fetcher, formData, isAdmin]);

  useEffect(() => {
    const beforeSignIn = (event: Event) => {
      const handoff = event as CustomEvent<BeforeSignInDetail>;
      if (loading || uploading || fetchLoading) {
        handoff.preventDefault();
        showAlert('Wait for the current save or upload before signing in.', { type: 'info' });
        return;
      }
      if (!dirty.current) return;
      if (!formData.name.trim() || !formData.storyBackground.trim() || !formData.writingStyle.trim()) {
        handoff.preventDefault();
        showAlert('Complete the name, background, and writing style so your template can be saved before sign-in.', { type: 'info' });
        return;
      }
      handoff.detail.pending.push(saveTemplate().then(() => { handoff.detail.returnTo = '/templates'; }));
    };
    window.addEventListener('aistory:before-signin', beforeSignIn);
    return () => window.removeEventListener('aistory:before-signin', beforeSignIn);
  }, [loading, uploading, fetchLoading, formData, saveTemplate, showAlert]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try { await saveTemplate(); router.push('/templates'); } catch { /* Fetcher displays the error. */ }
  };

  const handleInputChange = (field: string, value: string) => {
    dirty.current = true;
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handlePromptBuilderChange = (field: keyof PromptBuilderConfig, value: string) => {
    dirty.current = true;
    setFormData((prev) => ({
      ...prev,
      promptBuilder: {
        ...prev.promptBuilder,
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

        <PromptEditorSection
          promptBuilder={formData.promptBuilder}
          onPromptBuilderChange={handlePromptBuilderChange}
        />

        <FormField label="Story Background:">
          <Textarea
            value={formData.storyBackground}
            onChange={(e) => handleInputChange('storyBackground', e.target.value)}
            rows={6}
            required
          />
        </FormField>

        <FormField label="Writing Style:">
          <Textarea
            value={formData.writingStyle}
            onChange={(e) => handleInputChange('writingStyle', e.target.value)}
            rows={8}
            required
          />
        </FormField>

        {isAdmin && <FormField label="Public template:"><label className="flex items-center gap-2"><input type="checkbox" checked={formData.isPublic === true} onChange={(event) => { dirty.current = true; setFormData((previous) => ({ ...previous, isPublic: event.target.checked })); }} /> Make this template visible to everyone</label></FormField>}
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
