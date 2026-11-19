import type { GenerationProfile, LlmConfig, ModelPayloadReasoning, ModelPayloadShape, VerifiedModelPayload } from '@/types';
import type { generateText } from 'ai';
import { toAiSdkGenerationOptions } from '@/lib/generationProfiles';

export const modelPayloadReasoning = ['openai-none', 'openai-medium', 'together-enabled', 'together-max'] as const satisfies readonly ModelPayloadReasoning[];

// Limit the OpenAI sampling exceptions to models the installed Responses adapter
// can serialize correctly. GPT-5.1 and GPT-5.2 already default to no reasoning.
export function getDefaultModelPayload(model: LlmConfig): ModelPayloadShape {
  if (model.service === 'together') return { allowTemperature: true };
  if (/^gpt-5\.[12](?:-\d{4}-\d{2}-\d{2})?$/.test(model.model)) {
    return { allowTemperature: true, reasoning: 'openai-none' };
  }
  return { allowTemperature: /^(?:ft:)?gpt-(?:3\.5-turbo|4(?:o|\.1)?)(?:[-:]|$)/.test(model.model) };
}

export function matchesModelPayload(record: VerifiedModelPayload | undefined, model: LlmConfig): record is VerifiedModelPayload {
  if (!record || record.service !== model.service || record.model !== model.model) return false;
  const shape = record.shape;
  return typeof shape?.allowTemperature === 'boolean' && (shape.reasoning === undefined
    || modelPayloadReasoning.includes(shape.reasoning) && shape.reasoning.startsWith(model.service === 'openAi' ? 'openai-' : 'together-'));
}

export function resolveModelPayload(
  model: LlmConfig | null,
  actor: VerifiedModelPayload | undefined,
  defaults: VerifiedModelPayload | undefined,
): ModelPayloadShape | undefined {
  if (!model) return undefined;
  if (matchesModelPayload(actor, model)) return actor.shape;
  if (matchesModelPayload(defaults, model)) return defaults.shape;
  return getDefaultModelPayload(model);
}

function toProviderOptions(reasoning: ModelPayloadReasoning | undefined): Parameters<typeof generateText>[0]['providerOptions'] {
  switch (reasoning) {
    case 'openai-none': return { openai: { forceReasoning: true, reasoningEffort: 'none' } };
    case 'openai-medium': return { openai: { forceReasoning: true, reasoningEffort: 'medium' } };
    case 'together-enabled': return { togetherai: { reasoning: { enabled: true } } };
    case 'together-max': return { togetherai: { reasoningEffort: 'max' } };
  }
}

export function toModelGenerationOptions(profile: GenerationProfile, shape: ModelPayloadShape) {
  const options = toAiSdkGenerationOptions(shape.allowTemperature ? profile : { ...profile, temperature: null });
  const providerOptions = toProviderOptions(shape.reasoning);
  return providerOptions ? { ...options, providerOptions } : options;
}
