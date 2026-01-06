import { NextResponse } from "next/server";
import { auth } from "@/auth";
import dbConnect from "@/lib/mongodb";
import { UserModel } from "@/models";

// GET current user settings
export async function GET() {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await dbConnect();
    const user = await UserModel.findOne(
      { email: session.user.email },
      { selectedLlm: 1, apiKey: 1, _id: 0 }
    ).lean();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error fetching user settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

// PUT update user settings (only selectedLlm and apiKey)
export async function PUT(request: Request) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { selectedLlm, apiKey } = body;

    // Only allow updating selectedLlm and apiKey
    const updateData: Record<string, unknown> = {};

    if (selectedLlm !== undefined) {
      updateData.selectedLlm = selectedLlm;
    }

    if (apiKey !== undefined) {
      // Only update provided API key fields
      updateData.apiKey = {
        mistral: apiKey.mistral ?? null,
        together: apiKey.together ?? null,
        openAi: apiKey.openAi ?? null,
      };
    }

    await dbConnect();
    const result = await UserModel.updateOne(
      { email: session.user.email },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating user settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
