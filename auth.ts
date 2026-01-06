import NextAuth from "next-auth";
import authConfig from "./auth.config";
import dbConnect from "@/lib/mongodb";
import { UserModel } from "@/models";
import { User } from "@/types";

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

export { getCurrentUser };
