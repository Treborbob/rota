import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";

/** Current session, or null. Memoised per request. */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

/**
 * The authoritative way to identify the caller in pages, server actions and
 * route handlers. Redirects to sign-in when there is no valid session.
 */
export async function requireUser(): Promise<CurrentUser> {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }
  const { user } = session;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image ?? null,
  };
}
