import { type NextRequest, NextResponse } from "next/server";
import { isAllowedEmail, normaliseEmail } from "@/lib/allowlist";
import { auth, isDevLoginEnabled } from "@/lib/auth";

/**
 * GET /api/dev-login?email=<allowlisted>&name=<display name>
 *
 * Signs in (creating on first use) a password-based dev user and redirects
 * to the app. Only exists when ROTA_DEV_LOGIN=true in a non-production build.
 */
const DEV_PASSWORD = "rota-dev-password-not-for-production";

export async function GET(request: NextRequest) {
  if (!isDevLoginEnabled) {
    return new NextResponse("Not found", { status: 404 });
  }
  const email = normaliseEmail(request.nextUrl.searchParams.get("email") ?? "");
  const name = request.nextUrl.searchParams.get("name") ?? email.split("@")[0];
  if (!isAllowedEmail(email)) {
    return new NextResponse("Not on the allowlist", { status: 403 });
  }

  let response: Response;
  try {
    response = await auth.api.signInEmail({
      body: { email, password: DEV_PASSWORD },
      asResponse: true,
    });
    if (!response.ok) throw new Error("no such dev user yet");
  } catch {
    response = await auth.api.signUpEmail({
      body: { email, password: DEV_PASSWORD, name },
      asResponse: true,
    });
  }

  const redirect = NextResponse.redirect(new URL("/", request.url));
  for (const cookie of response.headers.getSetCookie()) {
    redirect.headers.append("set-cookie", cookie);
  }
  return redirect;
}
