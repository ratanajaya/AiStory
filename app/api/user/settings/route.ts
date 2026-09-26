import { validateTtsConfig } from '@/lib/ttsConfig';
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import dbConnect from "@/lib/mongodb";
import { UserModel } from "@/models";
import { validateLlmConfig } from "@/lib/llmSettings";
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
      { selectedLlm: 1, selectedTts: 1, apiKey: 1, _id: 0 }
    ).lean();

    if (!user) {
      return errorResponseFromMessage("User not found", 404);
    }

    return NextResponse.json({
      ...user,
      selectedTts: user.selectedTts ?? null,
      apiKey: _util.normalizeApiKeyConfig(user.apiKey),
    });
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
    const { selectedLlm, apiKey } = body;

    // Explicit allowlist; never accept ownership or role fields.
    const updateData: Record<string, unknown> = {};

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
      updateData.selectedLlm = llmResult.value;
    }

    if (apiKey !== undefined) {
      if (!apiKey || typeof apiKey !== 'object' || Array.isArray(apiKey)) return errorResponseFromMessage('Invalid API keys', 400);
      await dbConnect();
      const existing = await UserModel.findOne({ email: session.user.email }).select('apiKey').lean();
      if (!existing) return errorResponseFromMessage('User not found', 404);
      const merged = { ..._util.normalizeApiKeyConfig(existing.apiKey) };
      for (const service of ['together', 'openAi'] as const) {
        if (!(service in apiKey)) continue;
        const value = apiKey[service];
        if (value !== null && typeof value !== 'string') return errorResponseFromMessage('Invalid API key', 400);
        const normalized = _util.toInputString(value);
        if (normalized.length > 512) return errorResponseFromMessage('API key is too long', 400);
        merged[service] = normalized || null;
      }
      updateData.apiKey = merged;
    }

    await dbConnect();
    const result = await UserModel.updateOne(
      { email: session.user.email },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return errorResponseFromMessage("User not found", 404);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
