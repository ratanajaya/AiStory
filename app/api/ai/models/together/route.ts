import { NextResponse } from "next/server";
import { auth, getUserSettingWithFallback } from "@/auth";
import { errorResponse, errorResponseFromMessage } from "@/lib/apiError";
import { fetchTogetherChatModels, TogetherModelsError } from "@/lib/togetherModels";
import _util from "@/utils/_util";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.email) {
    return errorResponseFromMessage("Unauthorized", 401);
  }

  try {
    let body: { apiKey?: unknown } = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    let apiKey = typeof body.apiKey === "string" ? _util.toInputString(body.apiKey) : "";
    if (!apiKey) {
      const settings = await getUserSettingWithFallback();
      apiKey = _util.toInputString(settings.apiKey.together);
    }

    if (!apiKey) {
      return errorResponseFromMessage("Together API key is required to load models.", 400);
    }

    const models = await fetchTogetherChatModels(apiKey);
    return NextResponse.json({ models });
  } catch (err) {
    if (err instanceof TogetherModelsError) {
      return errorResponseFromMessage(err.message, err.status);
    }
    return errorResponse(err);
  }
}
