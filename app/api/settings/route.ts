import { validateTtsConfig, resolveTtsConfig } from '@/lib/ttsConfig';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/auth';
import dbConnect from '@/lib/mongodb';
import { KeyValueModel } from '@/models';
import type { DefaultValue } from '@/types';
import { validateLlmConfig } from '@/lib/llmSettings';
import { getConfiguredApiKeys, validateApiKeyUpdates } from '@/lib/apiKeySettings';
import { normalizeAutocompletePreference, validateAutocompletePreference } from '@/lib/autocompleteSettings';
import { checkModelPayloads } from '@/lib/modelPayloadProbe';
import { normalizeGenerationProfileConfig, validateGenerationProfileConfig } from '@/lib/generationProfiles';
import _constant from '@/utils/_constant';
import _util from '@/utils/_util';
import { errorResponse, errorResponseFromMessage } from '@/lib/apiError';
import { mergePromptBuilderWithDefaults, validatePromptBuilderConfig } from '@/lib/promptBuilderConfig';

const DEFAULT_KEY = 'defaultValue';

async function requireAdmin() {
  const user = await getCurrentUser();

  if (!user) {
    return errorResponseFromMessage('Unauthorized', 401);
  }

  if (!user.isAdmin) {
    return errorResponseFromMessage('Forbidden', 403);
  }

  return null;
}

function settingsResponse(value?: DefaultValue) {
  return NextResponse.json({
    selectedTts: resolveTtsConfig(value?.selectedTts),
    autocomplete: normalizeAutocompletePreference(value?.autocomplete),
    promptBuilder: mergePromptBuilderWithDefaults(value?.promptBuilder),
    generationProfiles: normalizeGenerationProfileConfig(value?.generationProfiles),
    configured: getConfiguredApiKeys(value?.apiKey),
    apiKey: _util.normalizeApiKeyConfig(value?.apiKey),
    selectedLlm: {
      service: value?.selectedLlm?.service || _constant.defaultSelectedLlm.service,
      model: value?.selectedLlm?.model || _constant.defaultSelectedLlm.model,
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function GET() {
  try {
    const adminError = await requireAdmin();
    if (adminError) {
      return adminError;
    }

    await dbConnect();
    const doc = await KeyValueModel.findOne({ key: DEFAULT_KEY });
    return settingsResponse(doc?.value as DefaultValue | undefined);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(request: Request) {
  try {
    const adminError = await requireAdmin();
    if (adminError) {
      return adminError;
    }

    await dbConnect();
    const body: Omit<DefaultValue, 'apiKey'> & { apiKey?: unknown; testModels?: boolean } = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return errorResponseFromMessage('Invalid settings', 400);
    if (body.testModels !== undefined && typeof body.testModels !== 'boolean') return errorResponseFromMessage('Invalid model test option', 400);
    const promptResult = validatePromptBuilderConfig(body.promptBuilder);
    if (!promptResult.ok) return errorResponseFromMessage(promptResult.message, 400);
    const llmResult = validateLlmConfig(body.selectedLlm);
    if (!llmResult.ok) {
      return errorResponseFromMessage(llmResult.message, 400);
    }
    if (!llmResult.value) {
      return errorResponseFromMessage("LLM provider and model are required.", 400);
    }
    const generationProfileResult = validateGenerationProfileConfig(body.generationProfiles);
    if (!generationProfileResult.ok) {
      return errorResponseFromMessage(generationProfileResult.message, 400);
    }

    const ttsResult = validateTtsConfig(body.selectedTts);
    if (!ttsResult.ok) return errorResponseFromMessage(ttsResult.message, 400);
    const keyResult = validateApiKeyUpdates(body.apiKey, { blankMeansClear: true });
    if (!keyResult.ok) return errorResponseFromMessage(keyResult.message, 400);

    const update: Record<string, unknown> = {
      'value.promptBuilder': promptResult.value,
      'value.generationProfiles': generationProfileResult.value,
      'value.selectedLlm': llmResult.value,
    };
    for (const [service, key] of Object.entries(keyResult.value)) update[`value.apiKey.${service}`] = key;
    if ('selectedTts' in body) update['value.selectedTts'] = resolveTtsConfig(ttsResult.value);
    let autocomplete: DefaultValue['autocomplete'];
    if ('autocomplete' in body) {
      const result = validateAutocompletePreference(body.autocomplete);
      if (!result.ok) return errorResponseFromMessage(result.message, 400);
      autocomplete = result.value;
      update['value.autocomplete'] = autocomplete;
    }
    if (body.testModels) {
      const current = await KeyValueModel.findOne({ key: DEFAULT_KEY }).lean();
      const defaults = current?.value as DefaultValue | undefined;
      if (autocomplete === undefined) autocomplete = normalizeAutocompletePreference(defaults?.autocomplete);
      const keys = { ..._util.normalizeApiKeyConfig(defaults?.apiKey), ...keyResult.value };
      const probe = await checkModelPayloads(llmResult.value, autocomplete?.model, keys, request.signal);
      if (!probe.ok) return errorResponseFromMessage(probe.message, probe.status);
      update['value.modelPayloads.story'] = probe.payloads.story;
      if (probe.payloads.autocomplete) update['value.modelPayloads.autocomplete'] = probe.payloads.autocomplete;
      if (request.signal.aborted) return errorResponseFromMessage('Model check canceled.', 499);
    }

    const doc = await KeyValueModel.findOneAndUpdate(
      { key: DEFAULT_KEY },
      { $set: update },
      { upsert: true, new: true }
    );

    if (body.testModels) return NextResponse.json({ success: true });
    return settingsResponse(doc.value as DefaultValue);
  } catch {
    return errorResponseFromMessage('Could not save default settings.', 500);
  }
}
