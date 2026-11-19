import { supportedLlmServices } from '@/lib/llmSettings';
import type { ApiKeyConfig, LLMService } from '@/types';
import _util from '@/utils/_util';

export type ConfiguredApiKeys = Record<LLMService, boolean>;

export function getConfiguredApiKeys(keys: Partial<ApiKeyConfig> | null | undefined): ConfiguredApiKeys {
  return {
    together: Boolean(_util.toInputString(keys?.together)),
    openAi: Boolean(_util.toInputString(keys?.openAi)),
    refuseless: Boolean(_util.toInputString(keys?.refuseless)),
  };
}

export function resolveApiKeys(
  personal: Partial<ApiKeyConfig> | null | undefined,
  defaults: Partial<ApiKeyConfig> | null | undefined,
): ApiKeyConfig {
  const resolveKey = (service: LLMService) =>
    _util.toIdentifierString(personal?.[service]) || _util.toIdentifierString(defaults?.[service]) || null;
  return {
    together: resolveKey('together'),
    openAi: resolveKey('openAi'),
    refuseless: resolveKey('refuseless'),
  };
}

export function validateApiKeyUpdates(input: unknown):
  { ok: true; value: Partial<ApiKeyConfig> } | { ok: false; message: string } {
  const updates: Partial<ApiKeyConfig> = {};
  if (input === undefined) return { ok: true, value: updates };
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, message: 'Invalid API keys' };

  const keys = input as Record<string, unknown>;
  for (const service of supportedLlmServices) {
    if (!Object.hasOwn(keys, service)) continue;
    const value = keys[service];
    if (value !== null && typeof value !== 'string') return { ok: false, message: 'Invalid API key' };
    const key = _util.toIdentifierString(value);
    if (key.length > 512) return { ok: false, message: 'API key is too long' };
    if (key || value === null) updates[service] = key || null;
  }
  return { ok: true, value: updates };
}
