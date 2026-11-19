import { validateTtsConfig } from '@/lib/ttsConfig';
import { NextResponse } from 'next/server';
import { errorResponse, errorResponseFromMessage } from '@/lib/apiError';
import { decryptGuestKey, encryptGuestKey, getGuestWorkspace, guestSettings, sameOrigin } from '@/lib/guest';
import { validateLlmConfig } from '@/lib/llmSettings';
import { getConfiguredApiKeys, validateApiKeyUpdates } from '@/lib/apiKeySettings';
import { checkModelPayloads } from '@/lib/modelPayloadProbe';
import { GuestWorkspaceModel, KeyValueModel } from '@/models';
import type { DefaultValue, LlmConfig } from '@/types';
import _constant from '@/utils/_constant';

export async function GET() {
  try {
    const settings = await guestSettings();
    if (!settings) return errorResponseFromMessage('Unauthorized', 401);
    return NextResponse.json({
      selectedTts: settings.guest.selectedTts ?? null, selectedLlm: settings.selectedLlm, configured: getConfiguredApiKeys(settings.apiKey),
    });
  } catch (error) { return errorResponse(error); }
}

export async function PUT(request: Request) {
  if (!sameOrigin(request)) return errorResponseFromMessage('Invalid origin', 403);
  try {
    const guest = await getGuestWorkspace();
    if (!guest) return errorResponseFromMessage('Unauthorized', 401);
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return errorResponseFromMessage('Invalid settings', 400);
    if (body.testModels !== undefined && typeof body.testModels !== 'boolean') return errorResponseFromMessage('Invalid model test option', 400);
    const updates: Record<string, unknown> = {};
    let story: LlmConfig | null | undefined;
    if ('selectedTts' in body) {
      const result = validateTtsConfig(body.selectedTts);
      if (!result.ok) return errorResponseFromMessage(result.message, 400);
      updates.selectedTts = result.value;
    }
    if ('selectedLlm' in body) {
      const result = validateLlmConfig(body.selectedLlm, { allowNull: true });
      if (!result.ok) return errorResponseFromMessage(result.message, 400);
      story = result.value;
      updates.selectedLlm = story;
    }
    const keyResult = validateApiKeyUpdates(body.apiKey);
    if (!keyResult.ok) return errorResponseFromMessage(keyResult.message, 400);
    const submittedKeys = keyResult.value;
    for (const [service, key] of Object.entries(submittedKeys)) {
      updates[`encryptedKeys.${service}`] = key ? encryptGuestKey(key) : null;
    }
    if (body.testModels) {
      const selected: LlmConfig | null = story === undefined ? guest.selectedLlm : story;
      const defaults = selected ? null : await KeyValueModel.findOne({ key: 'defaultValue' }).lean();
      const effectiveStory = selected ?? (defaults?.value as DefaultValue | undefined)?.selectedLlm ?? _constant.defaultSelectedLlm;
      const service = effectiveStory.service;
      const keys = { ..._constant.emptyApiKey, [service]: service in submittedKeys ? submittedKeys[service] : decryptGuestKey(guest.encryptedKeys?.[service]) };
      const probe = await checkModelPayloads(effectiveStory, null, keys, request.signal);
      if (!probe.ok) return errorResponseFromMessage(probe.message, probe.status);
      updates['modelPayloads.story'] = probe.payloads.story;
      if (request.signal.aborted) return errorResponseFromMessage('Model check canceled.', 499);
    }
    const updated = await GuestWorkspaceModel.updateOne({ guestId: guest.guestId, state: 'active', expiresAt: { $gt: new Date() } }, { $set: updates });
    if (!updated.matchedCount) return errorResponseFromMessage('Guest workspace expired', 401);
    return GET();
  } catch { return errorResponseFromMessage('Could not save guest settings.', 500); }
}
