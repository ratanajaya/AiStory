import { NextResponse } from 'next/server';
import { errorResponse, errorResponseFromMessage } from '@/lib/apiError';
import { encryptGuestKey, getGuestWorkspace, guestSettings, sameOrigin } from '@/lib/guest';
import { validateLlmConfig } from '@/lib/llmSettings';
import { GuestWorkspaceModel } from '@/models';
import _util from '@/utils/_util';

export async function GET() {
  try {
    const settings = await guestSettings();
    if (!settings) return errorResponseFromMessage('Unauthorized', 401);
    return NextResponse.json({ selectedLlm: settings.selectedLlm, configured: {
      together: Boolean(settings.apiKey.together), openAi: Boolean(settings.apiKey.openAi),
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
    const updates: Record<string, unknown> = {};
    if ('selectedLlm' in body) {
      const result = validateLlmConfig(body.selectedLlm, { allowNull: true });
      if (!result.ok) return errorResponseFromMessage(result.message, 400);
      updates.selectedLlm = result.value;
    }
    if ('apiKey' in body) {
      if (!body.apiKey || typeof body.apiKey !== 'object' || Array.isArray(body.apiKey)) return errorResponseFromMessage('Invalid API keys', 400);
      for (const service of ['together', 'openAi'] as const) {
        if (!(service in body.apiKey)) continue;
        const value = body.apiKey[service];
        if (value !== null && typeof value !== 'string') return errorResponseFromMessage('Invalid API key', 400);
        const normalized = _util.toInputString(value).trim();
        if (normalized.length > 512) return errorResponseFromMessage('API key is too long', 400);
        updates[`encryptedKeys.${service}`] = normalized ? encryptGuestKey(normalized) : null;
      }
    }
    const updated = await GuestWorkspaceModel.updateOne({ guestId: guest.guestId, state: 'active', expiresAt: { $gt: new Date() } }, { $set: updates });
    if (!updated.matchedCount) return errorResponseFromMessage('Guest workspace expired', 401);
    return GET();
  } catch (error) { return errorResponse(error); }
}
