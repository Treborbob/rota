"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, type TouchEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/** Previous evening / back to tonight / next evening. */
export function DayNav({
  previousHref,
  previousLabel,
  nextHref,
  nextLabel,
  isToday,
}: {
  previousHref: string;
  previousLabel: string;
  nextHref: string;
  nextLabel: string;
  isToday: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button variant="ghost" size="icon" className="size-11" asChild>
        <Link href={previousHref} aria-label={`Previous: ${previousLabel}`}>
          <ChevronLeft />
        </Link>
      </Button>
      {!isToday ? (
        <Button variant="ghost" size="sm" className="h-11" asChild>
          <Link href="/">Tonight</Link>
        </Button>
      ) : null}
      <Button variant="ghost" size="icon" className="size-11" asChild>
        <Link href={nextHref} aria-label={`Next: ${nextLabel}`}>
          <ChevronRight />
        </Link>
      </Button>
    </div>
  );
}

// Far enough to be deliberate, and clearly more sideways than up-and-down so
// scrolling the list never changes the day.
const COMMIT_PX = 72;
const MOSTLY_SIDEWAYS = 1.5;
// Leave the screen edges to the browser's own back/forward gesture.
const EDGE_PX = 24;

type Start = { x: number; y: number; tracking: boolean };

/** Swipe left for the next evening, right for the previous one. */
export function DaySwipe({
  previousHref,
  nextHref,
  children,
}: {
  previousHref: string;
  nextHref: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const start = useRef<Start | null>(null);
  const [offset, setOffset] = useState(0);

  function onTouchStart(e: TouchEvent<HTMLDivElement>) {
    const t = e.touches[0];
    // Touches inside a dialog bubble here through React's portal tree; only
    // the page itself should swipe.
    const onPage = e.currentTarget.contains(e.target as Node);
    const nearEdge = t.clientX < EDGE_PX || t.clientX > innerWidth - EDGE_PX;
    start.current =
      e.touches.length === 1 && onPage && !nearEdge
        ? { x: t.clientX, y: t.clientY, tracking: true }
        : null;
  }

  function onTouchMove(e: TouchEvent<HTMLDivElement>) {
    const s = start.current;
    if (!s?.tracking) return;
    const t = e.touches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) {
      s.tracking = false;
      setOffset(0);
      return;
    }
    // A hint of movement under the finger, not a full carousel.
    setOffset(dx / 4);
  }

  function onTouchEnd(e: TouchEvent<HTMLDivElement>) {
    const s = start.current;
    start.current = null;
    setOffset(0);
    if (!s?.tracking) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) < COMMIT_PX) return;
    if (Math.abs(dx) < Math.abs(dy) * MOSTLY_SIDEWAYS) return;
    router.push(dx < 0 ? nextHref : previousHref);
  }

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={() => {
        start.current = null;
        setOffset(0);
      }}
      style={{
        transform: offset ? `translateX(${offset}px)` : undefined,
        transition: offset ? "none" : "transform 150ms ease-out",
      }}
    >
      {children}
    </div>
  );
}
