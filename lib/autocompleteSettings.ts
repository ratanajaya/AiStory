import type { ApiKeyConfig, AutocompletePreference, LlmConfig, LLMService } from '@/types';
import { validateLlmConfig } from '@/lib/llmSettings';
import _util from '@/utils/_util';

type ValidationResult =
  | { ok: true; value: AutocompletePreference }
  | { ok: false; message: string };

export function validateAutocompletePreference(input: unknown): ValidationResult {
  if (input === null) return { ok: true, value: null };
  if (!input || typeof input !== 'object' || !('model' in input)) {
    return { ok: false, message: 'Invalid autocomplete preference.' };
  }
  if (input.model === null) return { ok: true, value: { model: null } };

  const result = validateLlmConfig(input.model);
  if (!result.ok || !result.value) {
    return { ok: false, message: 'Select a supported autocomplete provider and model.' };
  }
  const model = _util.toIdentifierString(result.value.model);
  return { ok: true, value: { model: { service: result.value.service, model } } };
}

export function normalizeAutocompletePreference(input: unknown): AutocompletePreference {
  const result = validateAutocompletePreference(input);
  return result.ok ? result.value : null;
}

export function resolveAutocompleteModel(preference: unknown, defaults: unknown): LlmConfig | null {
  return (normalizeAutocompletePreference(preference) ?? normalizeAutocompletePreference(defaults))?.model ?? null;
}

export function getAutocompleteKey(
  actor: { kind: 'user' | 'guest'; isAdmin: boolean },
  settings: {
    autocompleteModel: LlmConfig | null;
    personal: Record<LLMService, boolean>;
    apiKey: ApiKeyConfig;
  },
): string {
  const service = settings.autocompleteModel?.service;
  if (!service || (!settings.personal[service] && !(actor.kind === 'user' && actor.isAdmin))) return '';
  return _util.toIdentifierString(settings.apiKey[service]);
}
