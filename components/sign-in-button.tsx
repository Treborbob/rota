"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function SignInButton() {
  const [pending, setPending] = useState(false);

  async function signIn() {
    setPending(true);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/",
        errorCallbackURL: "/sign-in",
      });
    } finally {
      // The browser is redirected on success; only reset on failure.
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      size="lg"
      className="w-full"
      onClick={signIn}
      disabled={pending}
    >
      <GoogleMark />
      {pending ? "Opening Google…" : "Continue with Google"}
    </Button>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4">
      <path
        fill="currentColor"
        d="M21.6 12.23c0-.68-.06-1.33-.17-1.96H12v3.7h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.9-1.74 2.98-4.3 2.98-7.26Z"
      />
      <path
        fill="currentColor"
        opacity=".8"
        d="M12 22c2.7 0 4.96-.9 6.62-2.42l-3.24-2.5c-.9.6-2.04.95-3.38.95-2.6 0-4.8-1.75-5.59-4.1H3.07v2.58A10 10 0 0 0 12 22Z"
      />
      <path
        fill="currentColor"
        opacity=".6"
        d="M6.41 13.92A6 6 0 0 1 6.1 12c0-.67.11-1.31.31-1.92V7.5H3.07A10 10 0 0 0 2 12c0 1.61.39 3.14 1.07 4.5l3.34-2.58Z"
      />
      <path
        fill="currentColor"
        opacity=".9"
        d="M12 5.98c1.47 0 2.78.5 3.82 1.5l2.86-2.87A9.98 9.98 0 0 0 12 2a10 10 0 0 0-8.93 5.5l3.34 2.58C7.2 7.73 9.4 5.98 12 5.98Z"
      />
    </svg>
  );
}
