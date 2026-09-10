"use client";

import { Share, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const VISITS_KEY = "rota:visits";
const DISMISSED_KEY = "rota:a2hs-dismissed";
const SHOW_AFTER_VISITS = 3;

function isIosSafariBrowser(): boolean {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua);
  const standalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;
  return ios && !standalone;
}

/**
 * A quiet, dismissible nudge to install the app, shown on iOS Safari after a
 * few visits rather than on the first one.
 */
export function AddToHomeHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISSED_KEY)) return;
      const visits = Number(localStorage.getItem(VISITS_KEY) ?? "0") + 1;
      localStorage.setItem(VISITS_KEY, String(visits));
      if (visits >= SHOW_AFTER_VISITS && isIosSafariBrowser()) setShow(true);
    } catch {
      // Storage unavailable; skip the hint.
    }
  }, []);

  if (!show) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // ignore
    }
    setShow(false);
  }

  return (
    <div
      aria-live="polite"
      className="mb-6 flex items-start gap-3 rounded-xl border bg-card px-4 py-3 text-sm"
    >
      <Share className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p className="flex-1">
        Add Rota to your Home Screen: tap{" "}
        <span className="font-medium">Share</span>, then{" "}
        <span className="font-medium">Add to Home Screen</span>. It opens like
        an app.
      </p>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Dismiss"
        onClick={dismiss}
      >
        <X />
      </Button>
    </div>
  );
}
