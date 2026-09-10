import { cn } from "cn";
import {
  AlertCircle,
  CalendarClock,
  CircleDot,
  Clock,
  PauseCircle,
  Shuffle,
} from "lucide-react";
import type { DueState } from "@/lib/domain/due-state";

const STYLE: Record<
  DueState["kind"],
  { icon: typeof Clock; className: string }
> = {
  OVERDUE: {
    icon: AlertCircle,
    className:
      "bg-orange-100 text-orange-950 dark:bg-orange-500/20 dark:text-orange-100",
  },
  DUE: {
    icon: CircleDot,
    className:
      "bg-amber-100 text-amber-950 dark:bg-amber-500/20 dark:text-amber-100",
  },
  DUE_SOON: { icon: Clock, className: "bg-muted text-foreground" },
  NOT_DUE: { icon: CalendarClock, className: "text-muted-foreground" },
  ANYTIME: { icon: Shuffle, className: "text-muted-foreground" },
  DEFERRED: { icon: CalendarClock, className: "text-muted-foreground" },
  PAUSED: { icon: PauseCircle, className: "text-muted-foreground" },
};

/** Due state as icon + words. Never colour alone. */
export function DueBadge({
  state,
  label,
  className,
}: {
  state: DueState;
  label: string;
  className?: string;
}) {
  const { icon: Icon, className: tone } = STYLE[state.kind];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs",
        tone,
        className,
      )}
    >
      <Icon className="size-3" aria-hidden="true" />
      {label}
    </span>
  );
}
