import { resolveTtsConfig } from '@/lib/ttsConfig';
import { getUserSettingWithFallback } from '@/auth';
import dbConnect from '@/lib/mongodb';
import { KeyValueModel } from '@/models';
import { getActor, guestSettings, type Actor } from '@/lib/guest';
import { normalizeGenerationProfileConfig } from '@/lib/generationProfiles';
import { resolveAutocompleteModel } from '@/lib/autocompleteSettings';
import { resolveModelPayload } from '@/lib/modelPayload';
import type { ApiKeyConfig, DefaultValue, GenerationProfileConfig, LlmConfig, LLMService, ModelPayloadShape, TtsConfig } from '@/types';

export async function getActorGenerationSettings(resolvedActor?: Actor): Promise<{
  selectedTts: TtsConfig;
  autocompleteModel: LlmConfig | null;
  storyPayload: ModelPayloadShape | undefined;
  autocompletePayload: ModelPayloadShape | undefined;
  selectedLlm: LlmConfig; apiKey: ApiKeyConfig; generationProfiles: GenerationProfileConfig;
  personal: Record<LLMService, boolean>; trialAccount: boolean;
}> {
  const actor = resolvedActor ?? await getActor();
  if (!actor) throw new Error('Unauthorized');
  await dbConnect();
  if (actor.kind === 'user') {
    return getUserSettingWithFallback();
  }
  const [guest, defaultDoc] = await Promise.all([
    guestSettings(),
    KeyValueModel.findOne({ key: 'defaultValue' }).lean(),
  ]);
  if (!guest || !defaultDoc) throw new Error('Guest or default settings unavailable');
  const defaults = defaultDoc.value as DefaultValue;
  const selectedLlm = guest.selectedLlm || defaults.selectedLlm;
  const autocompleteModel = resolveAutocompleteModel(null, defaults.autocomplete);
  return {
    selectedLlm,
    autocompleteModel,
    storyPayload: resolveModelPayload(selectedLlm, guest.guest.modelPayloads?.story, defaults.modelPayloads?.story),
    autocompletePayload: resolveModelPayload(autocompleteModel, undefined, defaults.modelPayloads?.autocomplete),
    selectedTts: resolveTtsConfig(guest.guest.selectedTts, defaults.selectedTts),
    apiKey: {
      together: guest.apiKey.together || defaults.apiKey.together,
      openAi: guest.apiKey.openAi || defaults.apiKey.openAi,
      refuseless: guest.apiKey.refuseless || defaults.apiKey?.refuseless || null,
    },
    generationProfiles: normalizeGenerationProfileConfig(defaults.generationProfiles),
    personal: {
      together: Boolean(guest.apiKey.together),
      openAi: Boolean(guest.apiKey.openAi),
      refuseless: Boolean(guest.apiKey.refuseless),
    },
    trialAccount: true,
  };
}
