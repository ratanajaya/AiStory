'use client';

import { useState } from 'react';
import { useAiModelCatalog } from '@/components/AiModelCatalogProvider';
import type { ConfiguredApiKeys } from '@/lib/apiKeySettings';
import { supportedLlmServices } from '@/lib/llmSettings';
import type { ApiKeyConfig, LLMService } from '@/types';
import _constant from '@/utils/_constant';
import _util from '@/utils/_util';

export function useApiKeySettings(scope?: 'defaults') {
  const { getEntry, loadModels } = useAiModelCatalog();
  const [draft, setDraft] = useState<Partial<ApiKeyConfig>>({});
  const [configured, setConfigured] = useState<Partial<ConfiguredApiKeys>>({});
  const [modelKeys, setModelKeys] = useState<ApiKeyConfig>(_constant.emptyApiKey);

  function refreshModels(service: LLMService, apiKey: string) {
    setModelKeys(previous => ({ ...previous, [service]: apiKey }));
    void loadModels(service, apiKey, true, scope);
  }

  function updateKey(service: LLMService, value: string) {
    setDraft(previous => ({ ...previous, [service]: value }));
  }

  function onKeyBlur(service: LLMService, value: string) {
    if (value !== _util.toInputString(draft[service])) updateKey(service, value);
    const key = _util.toIdentifierString(value);
    if (key !== modelKeys[service]) refreshModels(service, key);
  }

  function toggleRemoval(service: LLMService) {
    setDraft(previous => ({ ...previous, [service]: previous[service] === null ? undefined : null }));
  }

  function getUpdates(form: HTMLFormElement): Partial<ApiKeyConfig> {
    const formData = new FormData(form);
    const updates: Partial<ApiKeyConfig> = {};
    for (const service of supportedLlmServices) {
      const value = formData.get(service);
      const key = typeof value === 'string' ? _util.toIdentifierString(value) : '';
      if (key) updates[service] = key;
      else if (draft[service] === null) updates[service] = null;
    }
    return updates;
  }

  function markSaved(updates: Partial<ApiKeyConfig>) {
    const flags: Partial<ConfiguredApiKeys> = {};
    for (const service of supportedLlmServices) {
      if (updates[service] === undefined) continue;
      flags[service] = Boolean(updates[service]);
      refreshModels(service, '');
    }
    setConfigured(previous => ({ ...previous, ...flags }));
    setDraft({});
  }

  return {
    draft,
    configured,
    setConfigured,
    modelKeys,
    getEntry,
    loadModels,
    updateKey,
    onKeyBlur,
    toggleRemoval,
    getUpdates,
    markSaved,
    ttsKeysDirty: [draft.together, draft.openAi].some(key => key === null || !_util.isNullOrWhitespace(key)),
  };
}
