import NextAuth from "next-auth";
import authConfig from "./auth.config";
import dbConnect from "@/lib/mongodb";
import { KeyValueModel, UserModel } from "@/models";
import { ApiKeyConfig, DefaultValue, LlmConfig, LLMService, User } from "@/types";
import _util from "./utils/_util";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  callbacks: {
    async signIn({ user }) {
      // Check if the user's email exists in the database
      if (!user.email) {
        return false;
      }

      try {
        await dbConnect();
        const existingUser = await UserModel.findOne({ email: user.email });

        if (!existingUser) {
          // Reject login if user doesn't exist in database
          return false;
        }

        // Update lastLoginAt
        await UserModel.updateOne(
          { email: user.email },
          { $set: { lastLoginAt: new Date() } }
        );

        return true;
      } catch (error) {
        console.error("Error during sign in:", error);
        return false;
      }
    },
    async session({ session }) {
      return session;
    },
  },
});

async function getCurrentUser(): Promise<User | null> {
  const session = await auth();

  if (!session?.user?.email) {
    return null;
  }

  try {
    await dbConnect();
    const user = await UserModel.findOne({ email: session.user.email }).lean();

    if (!user) {
      return null;
    }

    return {
      email: user.email,
      isAdmin: user.isAdmin,
      registeredAt: user.registeredAt,
      lastLoginAt: user.lastLoginAt,
      selectedLlm: user.selectedLlm,
      apiKey: user.apiKey,
    };
  } catch (error) {
    console.error("Error fetching current user:", error);
    return null;
  }
}

async function getUserSettingWithFallback(): Promise<{
  selectedLlm: LlmConfig;
  apiKey: ApiKeyConfig;
}> {
  const session = await auth();

  if (!session?.user?.email) {
    throw new Error("Unauthorized");
  }

  await dbConnect();
  const user = await UserModel.findOne({ email: session.user.email })!;
  const defaultDoc = await KeyValueModel.findOne({ key: 'defaultValue' })!;
  const defaultValue = defaultDoc.value as DefaultValue;
  const selectedLlm: LlmConfig = {
    service: _util.altString(user?.selectedLlm?.service, defaultValue.selectedLlm.service) as LLMService,
    model: _util.altString(user?.selectedLlm?.model, defaultValue.selectedLlm.model)!,
  };
  const apiKey: ApiKeyConfig = {
    mistral: _util.altString(user?.apiKey?.mistral, defaultValue.apiKey.mistral)!,
    together: _util.altString(user?.apiKey?.together, defaultValue.apiKey.together)!,
    openAi: _util.altString(user?.apiKey?.openAi, defaultValue.apiKey.openAi)!,
  };

  return { selectedLlm, apiKey };
}

export { getCurrentUser, getUserSettingWithFallback };
