import { validateTtsConfig } from '@/lib/ttsConfig';
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import dbConnect from "@/lib/mongodb";
import { KeyValueModel, UserModel } from "@/models";
import { validateLlmConfig } from "@/lib/llmSettings";
import { getConfiguredApiKeys, resolveApiKeys, validateApiKeyUpdates } from '@/lib/apiKeySettings';
import { normalizeAutocompletePreference, resolveAutocompleteModel, validateAutocompletePreference } from "@/lib/autocompleteSettings";
import { checkModelPayloads } from '@/lib/modelPayloadProbe';
import type { AutocompletePreference, DefaultValue, LlmConfig } from '@/types';
import _constant from '@/utils/_constant';
import _util from "@/utils/_util";
import { errorResponse, errorResponseFromMessage } from "@/lib/apiError";

// GET current user settings
export async function GET() {
  const session = await auth();

  if (!session?.user?.email) {
    return errorResponseFromMessage("Unauthorized", 401);
  }

  try {
    await dbConnect();
    const user = await UserModel.findOne(
      { email: session.user.email },
      { selectedLlm: 1, selectedTts: 1, autocomplete: 1, apiKey: 1, _id: 0 }
    ).lean();

    if (!user) {
      return errorResponseFromMessage("User not found", 404);
    }

    return NextResponse.json({
      selectedLlm: user.selectedLlm,
      selectedTts: user.selectedTts ?? null,
      autocomplete: normalizeAutocompletePreference(user.autocomplete),
      configured: getConfiguredApiKeys(user.apiKey),
      apiKey: _util.normalizeApiKeyConfig(user.apiKey),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return errorResponse(err);
  }
}

// PUT update only the current account's generation preferences and keys.
export async function PUT(request: Request) {
  const session = await auth();

  if (!session?.user?.email) {
    return errorResponseFromMessage("Unauthorized", 401);
  }

  try {
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return errorResponseFromMessage('Invalid settings', 400);
    const { selectedLlm, apiKey, testModels } = body;
    if (testModels !== undefined && typeof testModels !== 'boolean') return errorResponseFromMessage('Invalid model test option', 400);

    // Explicit allowlist; never accept ownership or role fields.
    const updateData: Record<string, unknown> = {};
    let story: LlmConfig | null | undefined;
    let autocomplete: AutocompletePreference | undefined;

    if ('autocomplete' in body) {
      const result = validateAutocompletePreference(body.autocomplete);
      if (!result.ok) return errorResponseFromMessage(result.message, 400);
      autocomplete = result.value;
      updateData.autocomplete = autocomplete;
    }

    if ('selectedTts' in body) {
      const result = validateTtsConfig(body.selectedTts);
      if (!result.ok) return errorResponseFromMessage(result.message, 400);
      updateData.selectedTts = result.value;
    }

    if (selectedLlm !== undefined) {
      const llmResult = validateLlmConfig(selectedLlm, { allowNull: true });
      if (!llmResult.ok) {
        return errorResponseFromMessage(llmResult.message, 400);
      }
      story = llmResult.value;
      updateData.selectedLlm = story;
    }

    const keyResult = validateApiKeyUpdates(apiKey, { blankMeansClear: true });
    if (!keyResult.ok) return errorResponseFromMessage(keyResult.message, 400);
    const keyUpdates = Object.entries(keyResult.value);

    await dbConnect();
    if (keyUpdates.length || testModels) {
      const existing = await UserModel.findOne({ email: session.user.email }, { apiKey: 1, selectedLlm: 1, autocomplete: 1 }).lean();
      if (!existing) return errorResponseFromMessage('User not found', 404);
      const keys = { ..._util.normalizeApiKeyConfig(existing.apiKey), ...keyResult.value };
      if (keyUpdates.length) {
        if (existing.apiKey === null) updateData.apiKey = keys;
        else for (const [service, key] of keyUpdates) updateData[`apiKey.${service}`] = key;
      }

      if (testModels) {
        const selected = story === undefined ? existing.selectedLlm : story;
        const defaultDoc = await KeyValueModel.findOne({ key: 'defaultValue' }).lean();
        const defaults = defaultDoc?.value as DefaultValue | undefined;
        const effectiveStory = selected ?? defaults?.selectedLlm ?? _constant.defaultSelectedLlm;
        const effectiveAutocomplete = resolveAutocompleteModel(autocomplete === undefined ? existing.autocomplete : autocomplete, defaults?.autocomplete);
        const probe = await checkModelPayloads(effectiveStory, effectiveAutocomplete, resolveApiKeys(keys, defaults?.apiKey), request.signal);
        if (!probe.ok) return errorResponseFromMessage(probe.message, probe.status);
        updateData['modelPayloads.story'] = probe.payloads.story;
        if (probe.payloads.autocomplete) updateData['modelPayloads.autocomplete'] = probe.payloads.autocomplete;
        if (request.signal.aborted) return errorResponseFromMessage('Model check canceled.', 499);
      }
    }
    const result = await UserModel.updateOne(
      { email: session.user.email },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return errorResponseFromMessage("User not found", 404);
    }

    return NextResponse.json({ success: true });
  } catch {
    return errorResponseFromMessage('Could not save account settings.', 500);
  }
}
