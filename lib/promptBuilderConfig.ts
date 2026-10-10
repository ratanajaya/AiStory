import type { PromptBuilderConfig } from '@/types';
import { withNarrationModeDefaults } from '@/lib/narrationModes';
import _constant from '@/utils/_constant';
import _util from '@/utils/_util';

const promptFields = Object.keys(_constant.emptyPromptBuilder) as (keyof PromptBuilderConfig)[];

export function validatePromptBuilderConfig(input: unknown):
  | { ok: true; value: PromptBuilderConfig }
  | { ok: false; message: string } {
  if (input != null && (typeof input !== 'object' || Array.isArray(input))) {
    return { ok: false, message: 'Prompt Builder must be an object.' };
  }
  const config = input as Partial<PromptBuilderConfig> | null | undefined;
  for (const field of promptFields) {
    if (config?.[field] != null && typeof config[field] !== 'string') {
      return { ok: false, message: `Prompt Builder field '${field}' must be a string or unset.` };
    }
  }
  return { ok: true, value: _util.normalizePromptBuilderConfig(config) };
}

export function mergePromptBuilderWithDefaults(
  config: Partial<PromptBuilderConfig> | null | undefined,
  defaults?: Partial<PromptBuilderConfig> | null,
): PromptBuilderConfig {
  const normalized = _util.normalizePromptBuilderConfig(config);
  const global = _util.normalizePromptBuilderConfig(defaults);
  const merged = { ...normalized };
  for (const field of promptFields) {
    merged[field] = _util.mergeNormalizedString(normalized[field], global[field]);
  }
  return withNarrationModeDefaults(merged);
}
