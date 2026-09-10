import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Optimistic redirect only: a session cookie's presence sends you into the
 * app, its absence sends you to sign-in. Real authorisation happens in
 * requireUser() on every page and action; a forged cookie gets nowhere.
 */
export function proxy(request: NextRequest) {
  const hasSession = Boolean(getSessionCookie(request));
  const { pathname } = request.nextUrl;

  if (pathname === "/sign-in") {
    return hasSession
      ? NextResponse.redirect(new URL("/", request.url))
      : NextResponse.next();
  }

  if (!hasSession) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Everything except the auth API, Next internals and static files.
  matcher: ["/((?!api/auth|_next|manifest\\.webmanifest|icons|.*\\..*).*)"],
};
