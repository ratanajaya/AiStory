'use client';

import { useCallback, useState } from 'react';
import { useAiModelCatalog } from '@/components/AiModelCatalogProvider';
import { resolveApiKeys } from '@/lib/apiKeySettings';
import { supportedLlmServices } from '@/lib/llmSettings';
import type { ApiKeyConfig, LLMService } from '@/types';
import _constant from '@/utils/_constant';
import _util from '@/utils/_util';

export function useApiKeySettings(scope?: 'defaults') {
  const { getEntry, loadModels } = useAiModelCatalog();
  const [draft, setDraft] = useState<ApiKeyConfig>(_constant.emptyApiKey);
  const [saved, setSaved] = useState<ApiKeyConfig>(_constant.emptyApiKey);
  const [modelKeys, setModelKeys] = useState<ApiKeyConfig>(_constant.emptyApiKey);

  const initialize = useCallback((keys: Partial<ApiKeyConfig> | null | undefined) => {
    const normalized = _util.normalizeApiKeyConfig(keys);
    const catalogKeys = resolveApiKeys(normalized, null);
    setDraft(normalized);
    setSaved(normalized);
    setModelKeys(catalogKeys);
    for (const service of supportedLlmServices) void loadModels(service, catalogKeys[service], false, scope);
  }, [loadModels, scope]);

  function refreshModels(service: LLMService, apiKey: string | null) {
    setModelKeys(previous => ({ ...previous, [service]: apiKey }));
    void loadModels(service, apiKey, true, scope);
  }

  function updateKey(service: LLMService, value: string) {
    setDraft(previous => ({ ...previous, [service]: value }));
  }

  function onKeyBlur(service: LLMService, value: string) {
    if (value !== _util.toInputString(draft[service])) updateKey(service, value);
    const key = _util.toIdentifierString(value) || null;
    if (key !== modelKeys[service]) refreshModels(service, key);
  }

  function getUpdates(form: HTMLFormElement): Partial<ApiKeyConfig> {
    const formData = new FormData(form);
    const updates: Partial<ApiKeyConfig> = {};
    for (const service of supportedLlmServices) {
      const value = formData.get(service);
      if (typeof value === 'string') updates[service] = _util.toIdentifierString(value) || null;
    }
    return updates;
  }

  function markSaved(updates: Partial<ApiKeyConfig>) {
    setDraft(previous => _util.normalizeApiKeyConfig({ ...previous, ...updates }));
    setSaved(previous => _util.normalizeApiKeyConfig({ ...previous, ...updates }));
    for (const service of supportedLlmServices) {
      if (updates[service] === undefined) continue;
      refreshModels(service, _util.toIdentifierString(updates[service]) || null);
    }
  }

  return {
    draft,
    initialize,
    modelKeys,
    getEntry,
    updateKey,
    onKeyBlur,
    getUpdates,
    markSaved,
    ttsKeysDirty: (['together', 'openAi'] as const).some(service =>
      _util.toIdentifierString(draft[service]) !== _util.toIdentifierString(saved[service])),
  };
}
