import { getActor } from '@/lib/guest';
import { getActorGenerationSettings } from '@/lib/actorSettings';
import { KeyValueModel } from '@/models';
import dbConnect from '@/lib/mongodb';
import { resolveTtsConfig } from '@/lib/ttsConfig';
import { TtsError } from '@/lib/ttsCatalog';
import _util from '@/utils/_util';
import type { DefaultValue } from '@/types';

export async function getTtsSettings(scope: unknown = 'actor') {
  const actor = await getActor();
  if (!actor) throw new TtsError('Unauthorized', 401);
  if (scope !== 'actor' && scope !== 'defaults') throw new TtsError('Invalid TTS scope.');
  if (scope === 'defaults') {
    if (!actor.isAdmin) throw new TtsError('Forbidden', 403);
    await dbConnect();
    const doc = await KeyValueModel.findOne({ key: 'defaultValue' }).lean();
    const defaults = doc?.value as DefaultValue | undefined;
    return { selectedTts: resolveTtsConfig(defaults?.selectedTts), apiKey: _util.normalizeApiKeyConfig(defaults?.apiKey),
      personal: { together: false, openAi: false }, trialAccount: false };
  }
  return getActorGenerationSettings();
}
