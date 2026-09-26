import { getUserSettingWithFallback } from '@/auth';
import dbConnect from '@/lib/mongodb';
import { KeyValueModel } from '@/models';
import { getActor, guestSettings } from '@/lib/guest';
import { normalizeGenerationProfileConfig } from '@/lib/generationProfiles';
import type { ApiKeyConfig, DefaultValue, GenerationProfileConfig, LlmConfig, LLMService } from '@/types';

export async function getActorGenerationSettings(): Promise<{
  selectedLlm: LlmConfig; apiKey: ApiKeyConfig; generationProfiles: GenerationProfileConfig;
  personal: Record<LLMService, boolean>; trialAccount: boolean;
}> {
  const actor = await getActor();
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
  return {
    selectedLlm: guest.selectedLlm || defaults.selectedLlm,
    apiKey: {
      together: guest.apiKey.together || defaults.apiKey.together,
      openAi: guest.apiKey.openAi || defaults.apiKey.openAi,
    },
    generationProfiles: normalizeGenerationProfileConfig(defaults.generationProfiles),
    personal: { together: Boolean(guest.apiKey.together), openAi: Boolean(guest.apiKey.openAi) },
    trialAccount: true,
  };
}
