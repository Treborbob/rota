import { LogoMark } from "@/components/logo";
import { SignInButton } from "@/components/sign-in-button";

const ERROR_MESSAGES: Record<string, string> = {
  not_allowed: "That Google account isn't on the Rota allowlist.",
  email_not_verified: "Google hasn't verified that email address yet.",
  access_denied: "Google sign-in was cancelled.",
  account_not_linked:
    "That email already has an account here that isn't linked to Google.",
};

export default async function SignInPage({
  searchParams,
}: PageProps<"/sign-in">) {
  const params = await searchParams;
  const code = typeof params.error === "string" ? params.error : null;
  const description =
    typeof params.error_description === "string"
      ? params.error_description
      : null;
  const message = code
    ? (ERROR_MESSAGES[code] ?? description ?? "Sign-in didn't work. Try again.")
    : null;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <LogoMark className="size-16" />
          <h1 className="font-semibold text-3xl tracking-tight">Rota</h1>
          <p className="text-muted-foreground">
            The Black family chore rota. Members only.
          </p>
        </div>

        {message ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm"
          >
            {message}
          </p>
        ) : null}

        <SignInButton />
      </div>
    </main>
  );
}
