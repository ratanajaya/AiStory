import type {
  AiGenerationFeature,
  GenerationProfile,
  GenerationProfileConfig,
} from '@/types';
import _constant from '@/utils/_constant';

export const aiGenerationFeatures = [
  'default',
  'narration',
  'outlineIdeaGenerator',
  'enhancer',
  'segmentSummarizer',
  'chapterSummarizer',
  'longTermMemory',
] as const satisfies readonly AiGenerationFeature[];

export function isAiGenerationFeature(value: unknown): value is AiGenerationFeature {
  return typeof value === 'string' && aiGenerationFeatures.includes(value as AiGenerationFeature);
}

const cloneProfile = (profile: GenerationProfile): GenerationProfile => ({ ...profile });

export function getDefaultGenerationProfiles(): GenerationProfileConfig {
  return Object.fromEntries(
    aiGenerationFeatures.map((feature) => [feature, cloneProfile(_constant.defaultGenerationProfiles[feature])])
  ) as GenerationProfileConfig;
}

const isValidTemperature = (value: unknown): value is number | null => {
  return value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 2);
};

const isIntegerInRange = (value: unknown, minimum: number, maximum: number): value is number => {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum;
};

const isValidProfile = (value: unknown): value is GenerationProfile => {
  if (!value || typeof value !== 'object') return false;
  const profile = value as Partial<GenerationProfile>;
  return isValidTemperature(profile.temperature)
    && isIntegerInRange(profile.maxOutputTokens, 128, 4096)
    && isIntegerInRange(profile.timeoutMs, 5000, 120000)
    && isIntegerInRange(profile.maxRetries, 0, 2);
};

export function normalizeGenerationProfileConfig(input: unknown): GenerationProfileConfig {
  const defaults = getDefaultGenerationProfiles();
  if (!input || typeof input !== 'object') return defaults;

  const candidate = input as Partial<Record<AiGenerationFeature, unknown>>;
  return Object.fromEntries(
    aiGenerationFeatures.map((feature) => [
      feature,
      isValidProfile(candidate[feature]) ? cloneProfile(candidate[feature]) : defaults[feature],
    ])
  ) as GenerationProfileConfig;
}

type GenerationProfileValidationResult =
  | { ok: true; value: GenerationProfileConfig }
  | { ok: false; message: string };

export function validateGenerationProfileConfig(input: unknown): GenerationProfileValidationResult {
  if (input == null) {
    return { ok: true, value: getDefaultGenerationProfiles() };
  }

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, message: 'Generation profiles must be an object.' };
  }

  const candidate = input as Partial<Record<AiGenerationFeature, unknown>>;
  for (const feature of aiGenerationFeatures) {
    const profile = candidate[feature];
    if (!profile || typeof profile !== 'object') {
      return { ok: false, message: `Generation profile '${feature}' is required.` };
    }

    const values = profile as Partial<GenerationProfile>;
    if (!isValidTemperature(values.temperature)) {
      return { ok: false, message: `Generation profile '${feature}' temperature must be null or a number from 0 to 2.` };
    }
    if (!isIntegerInRange(values.maxOutputTokens, 128, 4096)) {
      return { ok: false, message: `Generation profile '${feature}' maxOutputTokens must be an integer from 128 to 4096.` };
    }
    if (!isIntegerInRange(values.timeoutMs, 5000, 120000)) {
      return { ok: false, message: `Generation profile '${feature}' timeoutMs must be an integer from 5000 to 120000.` };
    }
    if (!isIntegerInRange(values.maxRetries, 0, 2)) {
      return { ok: false, message: `Generation profile '${feature}' maxRetries must be an integer from 0 to 2.` };
    }
  }

  return { ok: true, value: normalizeGenerationProfileConfig(candidate) };
}

export function toAiSdkGenerationOptions(profile: GenerationProfile) {
  return {
    maxOutputTokens: profile.maxOutputTokens,
    timeout: { totalMs: profile.timeoutMs },
    maxRetries: profile.maxRetries,
    ...(profile.temperature === null ? {} : { temperature: profile.temperature }),
  };
}
