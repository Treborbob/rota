"use client";

import { RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Catches anything thrown while rendering an app screen (a sleepy database
 * is the likely culprit) and offers a retry instead of a blank page.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="rounded-xl border border-dashed px-6 py-12 text-center">
      <p className="font-medium">Something didn't load</p>
      <p className="mt-1 text-muted-foreground text-sm">
        Usually a slow database waking up. Give it another go.
      </p>
      <div className="mt-4">
        <Button onClick={() => reset()}>
          <RefreshCw />
          Try again
        </Button>
      </div>
    </div>
  );
}
