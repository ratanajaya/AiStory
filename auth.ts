import NextAuth from "next-auth";
import type { Session } from "next-auth";
import authConfig from "./auth.config";
import dbConnect from "@/lib/mongodb";
import { getAuthSessionOverrideUser } from "@/lib/authSessionOverride";
import { KeyValueModel, UserModel } from "@/models";
import { ApiKeyConfig, DefaultValue, GenerationProfileConfig, LlmConfig, LLMService, User } from "@/types";
import { normalizeGenerationProfileConfig } from "@/lib/generationProfiles";
import _util from "./utils/_util";

const { handlers, signIn, signOut, auth: baseAuth } = NextAuth({
  ...authConfig,
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google" || !user.email || profile?.email_verified !== true) {
        return false;
      }

      try {
        await dbConnect();
        await UserModel.updateOne(
          { email: user.email },
          {
            $setOnInsert: { email: user.email, isAdmin: false, registeredAt: new Date(), trialAccount: true, trialTextUsed: 0, trialAudioUsed: 0 },
            $set: { lastLoginAt: new Date() },
          },
          { upsert: true }
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

const authOverrideUser = getAuthSessionOverrideUser();

async function auth(): Promise<Session | null> {
  if (authOverrideUser) {
    return {
      user: authOverrideUser,
      expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  return baseAuth();
}

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
  generationProfiles: GenerationProfileConfig;
  personal: Record<LLMService, boolean>;
  trialAccount: boolean;
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
    together: _util.altString(user?.apiKey?.together, defaultValue.apiKey.together)!,
    openAi: _util.altString(user?.apiKey?.openAi, defaultValue.apiKey.openAi)!,
  };

  return {
    selectedLlm,
    apiKey,
    generationProfiles: normalizeGenerationProfileConfig(defaultValue.generationProfiles),
    // Funding must describe the same user record that supplied the credentials.
    personal: {
      together: Boolean(_util.toInputString(user?.apiKey?.together)),
      openAi: Boolean(_util.toInputString(user?.apiKey?.openAi)),
    },
    trialAccount: Boolean(user?.trialAccount),
  };
}

export { handlers, signIn, signOut, auth, getCurrentUser, getUserSettingWithFallback };
