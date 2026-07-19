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
      { selectedLlm: 1, apiKey: 1, _id: 0 }
    ).lean();

    if (!user) {
      return errorResponseFromMessage("User not found", 404);
    }

    return NextResponse.json({
      ...user,
      apiKey: _util.normalizeApiKeyConfig(user.apiKey),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

// PUT update user settings (only selectedLlm and apiKey)
export async function PUT(request: Request) {
  const session = await auth();

  if (!session?.user?.email) {
    return errorResponseFromMessage("Unauthorized", 401);
  }

  try {
    const body = await request.json();
    const { selectedLlm, apiKey } = body;

    // Only allow updating selectedLlm and apiKey
    const updateData: Record<string, unknown> = {};

    if (selectedLlm !== undefined) {
      const llmResult = validateLlmConfig(selectedLlm, { allowNull: true });
      if (!llmResult.ok) {
        return errorResponseFromMessage(llmResult.message, 400);
      }
      updateData.selectedLlm = llmResult.value;
    }

    if (apiKey !== undefined) {
      updateData.apiKey = _util.normalizeApiKeyConfig(apiKey);
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
