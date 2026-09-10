import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { isAllowedEmail } from "@/lib/allowlist";
import { DEFAULT_WEEKDAY_CAPACITY } from "@/lib/capacity";
import { db } from "@/lib/db";

const THIRTY_DAYS = 60 * 60 * 24 * 30;

export const auth = betterAuth({
  appName: "Rota",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      // Google reports a trustworthy email_verified claim; insist on it.
      requireEmailVerification: true,
      prompt: "select_account",
    },
  },

  user: {
    additionalFields: {
      active: { type: "boolean", defaultValue: true, input: false },
    },
    // Runs before a user is created, before an account is linked, and on
    // every sign-in of an existing user with the fresh provider email.
    // This is the allowlist. Anyone not on it never gets a row.
    validateUserInfo: ({ user }) => {
      if (!isAllowedEmail(user.email)) {
        return {
          error: "not_allowed",
          errorDescription: "This Google account isn't on the Rota allowlist.",
        };
      }
    },
  },

  databaseHooks: {
    user: {
      create: {
        // First sign-in: give the new member their default weekday minutes.
        after: async (user) => {
          await db.weekdayCapacity.createMany({
            data: DEFAULT_WEEKDAY_CAPACITY.map((minutes, i) => ({
              userId: user.id,
              weekday: i + 1,
              minutes,
            })),
            skipDuplicates: true,
          });
        },
      },
    },
  },

  session: {
    expiresIn: THIRTY_DAYS,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },

  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
