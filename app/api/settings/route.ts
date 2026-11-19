import { validateTtsConfig, resolveTtsConfig } from '@/lib/ttsConfig';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/auth';
import dbConnect from '@/lib/mongodb';
import { KeyValueModel } from '@/models';
import { DefaultValue } from '@/types';
import { validateLlmConfig } from '@/lib/llmSettings';
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
      return NextResponse.json(emptyDefaultValue);
    }

    const value = doc.value as DefaultValue;

    const responseValue: DefaultValue = {
      selectedTts: resolveTtsConfig(value.selectedTts),
      autocomplete: normalizeAutocompletePreference(value.autocomplete),
      promptBuilder: mergePromptBuilderWithDefaults(value.promptBuilder),
      generationProfiles: normalizeGenerationProfileConfig(value.generationProfiles),
      apiKey: _util.normalizeApiKeyConfig(value.apiKey),
      selectedLlm: {
        service: value.selectedLlm?.service || _constant.defaultSelectedLlm.service,
        model: value.selectedLlm?.model || _constant.defaultSelectedLlm.model,
      },
    };

    return NextResponse.json(responseValue);
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
    const body: DefaultValue & { testModels?: boolean } = await request.json();
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
      || (['openAi', 'together'] as const).some(service => body.apiKey[service] != null && typeof body.apiKey[service] !== 'string'))) {
      return errorResponseFromMessage('Invalid API keys', 400);
    }
    const keys = _util.normalizeApiKeyConfig(body.apiKey);
    const update: Record<string, unknown> = {
      'value.promptBuilder': promptResult.value,
      'value.generationProfiles': generationProfileResult.value,
      'value.apiKey': keys,
      'value.selectedLlm': llmResult.value,
    };
    if ('selectedTts' in body) update['value.selectedTts'] = resolveTtsConfig(ttsResult.value);
    let autocomplete: DefaultValue['autocomplete'];
    if ('autocomplete' in body) {
      const result = validateAutocompletePreference(body.autocomplete);
      if (!result.ok) return errorResponseFromMessage(result.message, 400);
      autocomplete = result.value;
      update['value.autocomplete'] = autocomplete;
    }
    if (body.testModels) {
      if (autocomplete === undefined) {
        const current = await KeyValueModel.findOne({ key: DEFAULT_KEY }).lean();
        autocomplete = normalizeAutocompletePreference((current?.value as DefaultValue | undefined)?.autocomplete);
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
      selectedTts: resolveTtsConfig(saved.selectedTts),
      autocomplete: normalizeAutocompletePreference(saved.autocomplete),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
