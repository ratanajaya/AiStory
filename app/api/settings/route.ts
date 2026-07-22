import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/auth';
import dbConnect from '@/lib/mongodb';
import { KeyValueModel } from '@/models';
import { DefaultValue } from '@/types';
import { validateLlmConfig } from '@/lib/llmSettings';
import _constant from '@/utils/_constant';
import _util from '@/utils/_util';
import { errorResponse, errorResponseFromMessage } from '@/lib/apiError';

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
        prompt: { ..._constant.emptyPrompt },
        promptBuilder: { ..._constant.emptyPromptBuilder },
        apiKey: { ..._constant.emptyApiKey },
        selectedLlm: { ..._constant.defaultSelectedLlm },
      };
      return NextResponse.json(emptyDefaultValue);
    }

    const value = doc.value as DefaultValue;

    return NextResponse.json({
      ...value,
      prompt: _util.normalizePromptConfig(value.prompt),
      promptBuilder: _util.normalizePromptBuilderConfig(value.promptBuilder),
      apiKey: _util.normalizeApiKeyConfig(value.apiKey),
      selectedLlm: {
        service: value.selectedLlm?.service || _constant.defaultSelectedLlm.service,
        model: value.selectedLlm?.model || _constant.defaultSelectedLlm.model,
      },
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
    const body: DefaultValue = await request.json();
    const llmResult = validateLlmConfig(body.selectedLlm);
    if (!llmResult.ok) {
      return errorResponseFromMessage(llmResult.message, 400);
    }
    if (!llmResult.value) {
      return errorResponseFromMessage("LLM provider and model are required.", 400);
    }

    const normalizedValue: DefaultValue = {
      prompt: _util.normalizePromptConfig(body.prompt),
      promptBuilder: _util.normalizePromptBuilderConfig(body.promptBuilder),
      apiKey: _util.normalizeApiKeyConfig(body.apiKey),
      selectedLlm: llmResult.value,
    };

    const doc = await KeyValueModel.findOneAndUpdate(
      { key: DEFAULT_KEY },
      { key: DEFAULT_KEY, value: normalizedValue },
      { upsert: true, new: true }
    );

    return NextResponse.json(doc.value as DefaultValue);
  } catch (err) {
    return errorResponse(err);
  }
}
