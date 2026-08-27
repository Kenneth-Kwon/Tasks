import { google } from "googleapis";
import { db } from "./db";

export async function getGoogleClient(userId: string) {
  const account = await db.account.findFirst({
    where: { userId, provider: "google" },
  });
  if (!account?.access_token) throw new Error("Google 계정이 연결되어 있지 않습니다.");

  const oauth2Client = new google.auth.OAuth2(
    process.env.AUTH_GOOGLE_ID,
    process.env.AUTH_GOOGLE_SECRET,
    `${process.env.NEXTAUTH_URL}/api/auth/callback/google`
  );
  oauth2Client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token ?? undefined,
    expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
  });
  oauth2Client.on("tokens", async (tokens) => {
    if (tokens.access_token) {
      await db.account.update({
        where: { id: account.id },
        data: {
          access_token: tokens.access_token,
          expires_at: tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : undefined,
        },
      });
    }
  });
  return google.tasks({ version: "v1", auth: oauth2Client });
}

export function parseGoogleDue(due?: string | null): Date | null {
  if (!due) return null;
  return new Date(due);
}

export function toGoogleDue(date: Date | null): string | undefined {
  if (!date) return undefined;
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

