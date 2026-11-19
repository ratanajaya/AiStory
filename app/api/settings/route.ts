import { validateTtsConfig, resolveTtsConfig } from '@/lib/ttsConfig';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/auth';
import dbConnect from '@/lib/mongodb';
import { KeyValueModel } from '@/models';
import type { ApiKeyConfig, DefaultValue } from '@/types';
import { supportedLlmServices, validateLlmConfig } from '@/lib/llmSettings';
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

export async function GET() {
  try {
    const adminError = await requireAdmin();
    if (adminError) {
      return adminError;
    }

    await dbConnect();
    const doc = await KeyValueModel.findOne({ key: DEFAULT_KEY });

    if (!doc) {
      // This should never happen in practice, but keep a safe fallback for unset data.
      const emptyDefaultValue: DefaultValue = {
        selectedTts: resolveTtsConfig(null),
        autocomplete: null,
        promptBuilder: mergePromptBuilderWithDefaults(null),
        generationProfiles: normalizeGenerationProfileConfig(null),
        apiKey: { ..._constant.emptyApiKey },
        selectedLlm: { ..._constant.defaultSelectedLlm },
      };
      return NextResponse.json({ ...emptyDefaultValue, refuselessKeyConfigured: false });
    }

    const value = doc.value as DefaultValue;

    const responseValue: DefaultValue = {
      selectedTts: resolveTtsConfig(value.selectedTts),
      autocomplete: normalizeAutocompletePreference(value.autocomplete),
      promptBuilder: mergePromptBuilderWithDefaults(value.promptBuilder),
      generationProfiles: normalizeGenerationProfileConfig(value.generationProfiles),
      apiKey: { ..._util.normalizeApiKeyConfig(value.apiKey), refuseless: '' },
      selectedLlm: {
        service: value.selectedLlm?.service || _constant.defaultSelectedLlm.service,
        model: value.selectedLlm?.model || _constant.defaultSelectedLlm.model,
      },
    };

    return NextResponse.json({
      ...responseValue,
      refuselessKeyConfigured: Boolean(_util.toInputString(value.apiKey?.refuseless)),
    });
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
    const body: Omit<DefaultValue, 'apiKey'> & { apiKey?: Partial<ApiKeyConfig>; testModels?: boolean } = await request.json();
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
    if (body.apiKey != null && (typeof body.apiKey !== 'object' || Array.isArray(body.apiKey)
      || supportedLlmServices.some(service => body.apiKey?.[service] != null && typeof body.apiKey[service] !== 'string'))) {
      return errorResponseFromMessage('Invalid API keys', 400);
    }
    const keys = _util.normalizeApiKeyConfig(body.apiKey);
    const updateRefuselessKey = body.apiKey?.refuseless !== undefined;
    keys.refuseless = _util.toIdentifierString(keys.refuseless);
    if (keys.refuseless.length > 512) return errorResponseFromMessage('API key is too long', 400);
    const update: Record<string, unknown> = {
      'value.promptBuilder': promptResult.value,
      'value.generationProfiles': generationProfileResult.value,
      'value.apiKey.together': keys.together,
      'value.apiKey.openAi': keys.openAi,
      'value.selectedLlm': llmResult.value,
    };
    if (updateRefuselessKey) update['value.apiKey.refuseless'] = keys.refuseless;
    if ('selectedTts' in body) update['value.selectedTts'] = resolveTtsConfig(ttsResult.value);
    let autocomplete: DefaultValue['autocomplete'];
    if ('autocomplete' in body) {
      const result = validateAutocompletePreference(body.autocomplete);
      if (!result.ok) return errorResponseFromMessage(result.message, 400);
      autocomplete = result.value;
      update['value.autocomplete'] = autocomplete;
    }
    if (body.testModels) {
      const usesRefuseless = llmResult.value.service === 'refuseless' || autocomplete?.model?.service === 'refuseless';
      if (autocomplete === undefined || (!updateRefuselessKey && usesRefuseless)) {
        const current = await KeyValueModel.findOne({ key: DEFAULT_KEY }).lean();
        const defaults = current?.value as DefaultValue | undefined;
        if (autocomplete === undefined) autocomplete = normalizeAutocompletePreference(defaults?.autocomplete);
        if (!updateRefuselessKey) keys.refuseless = _util.toInputString(defaults?.apiKey?.refuseless);
      }
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
    const saved = { ...doc.value } as DefaultValue;
    delete saved.modelPayloads;
    return NextResponse.json({
      ...saved,
      apiKey: { ..._util.normalizeApiKeyConfig(saved.apiKey), refuseless: '' },
      refuselessKeyConfigured: Boolean(_util.toInputString(saved.apiKey?.refuseless)),
      selectedTts: resolveTtsConfig(saved.selectedTts),
      autocomplete: normalizeAutocompletePreference(saved.autocomplete),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
