import { validateTtsConfig } from '@/lib/ttsConfig';
import { NextResponse } from 'next/server';
import { errorResponse, errorResponseFromMessage } from '@/lib/apiError';
import { decryptGuestKey, encryptGuestKey, getGuestWorkspace, guestSettings, sameOrigin } from '@/lib/guest';
import { supportedLlmServices, validateLlmConfig } from '@/lib/llmSettings';
import { checkModelPayloads } from '@/lib/modelPayloadProbe';
import { GuestWorkspaceModel, KeyValueModel } from '@/models';
import type { ApiKeyConfig, DefaultValue, LlmConfig } from '@/types';
import _constant from '@/utils/_constant';
import _util from '@/utils/_util';

export async function GET() {
  try {
    const settings = await guestSettings();
    if (!settings) return errorResponseFromMessage('Unauthorized', 401);
    return NextResponse.json({ selectedTts: settings.guest.selectedTts ?? null, selectedLlm: settings.selectedLlm, configured: {
      together: Boolean(settings.apiKey.together), openAi: Boolean(settings.apiKey.openAi), refuseless: Boolean(settings.apiKey.refuseless),
    } });
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
    const submittedKeys: Partial<ApiKeyConfig> = {};
    if ('apiKey' in body) {
      if (!body.apiKey || typeof body.apiKey !== 'object' || Array.isArray(body.apiKey)) return errorResponseFromMessage('Invalid API keys', 400);
      for (const service of supportedLlmServices) {
        if (!(service in body.apiKey)) continue;
        const value = body.apiKey[service];
        if (value !== null && typeof value !== 'string') return errorResponseFromMessage('Invalid API key', 400);
        const normalized = _util.toIdentifierString(value);
        if (normalized.length > 512) return errorResponseFromMessage('API key is too long', 400);
        submittedKeys[service] = normalized || null;
        updates[`encryptedKeys.${service}`] = normalized ? encryptGuestKey(normalized) : null;
      }
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
  } catch (error) { return errorResponse(error); }
}
