import _util from "@/utils/_util";
import type { Session } from "next-auth";

type OverridePayload = Record<string, unknown>;

export function getAuthSessionOverrideUser(): Session["user"] | null {
  const rawOverride = process.env.AUTH_SESSION_OVERRIDE;

  if (!rawOverride) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawOverride) as OverridePayload;
    const email = parsed.email as string | undefined;

    if (_util.isNullOrWhitespace(email)) {
      return null;
    }

    // Keep room for future fields while normalizing current common user fields.
    const user: Session["user"] = {
      ...(parsed as Session["user"]),
      email: email!.trim(),
    };

    if (user.name != null && _util.isNullOrWhitespace(user.name)) {
      user.name = null;
    }

    if (user.image != null && _util.isNullOrWhitespace(user.image)) {
      user.image = null;
    }

    return user;
  } catch (error) {
    console.error("Invalid AUTH_SESSION_OVERRIDE value:", error);
    return null;
  }
}
