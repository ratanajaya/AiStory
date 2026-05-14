import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { KeyValueModel } from '@/models';
import { DefaultValue } from '@/types';
import _constant from '@/utils/_constant';
import _util from '@/utils/_util';

const DEFAULT_KEY = 'defaultValue';

export async function GET() {
  try {
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
    } satisfies DefaultValue);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await dbConnect();
    const body: DefaultValue = await request.json();
    const normalizedValue: DefaultValue = {
      prompt: _util.normalizePromptConfig(body.prompt),
      promptBuilder: _util.normalizePromptBuilderConfig(body.promptBuilder),
      apiKey: _util.normalizeApiKeyConfig(body.apiKey),
      selectedLlm: {
        service: body.selectedLlm?.service || _constant.defaultSelectedLlm.service,
        model: body.selectedLlm?.model || _constant.defaultSelectedLlm.model,
      },
    };
    
    const doc = await KeyValueModel.findOneAndUpdate(
      { key: DEFAULT_KEY },
      { key: DEFAULT_KEY, value: normalizedValue },
      { upsert: true, new: true }
    );
    
    return NextResponse.json(doc.value as DefaultValue);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
