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
  OVERDUE: { icon: AlertCircle, className: "bg-rota-rose-soft text-rota-rose" },
  DUE: { icon: CircleDot, className: "bg-rota-orange-soft text-rota-orange" },
  DUE_SOON: { icon: Clock, className: "bg-rota-teal-soft text-rota-teal" },
  NOT_DUE: { icon: CalendarClock, className: "bg-muted text-muted-foreground" },
  ANYTIME: { icon: Shuffle, className: "bg-muted text-muted-foreground" },
  DEFERRED: {
    icon: CalendarClock,
    className: "bg-muted text-muted-foreground",
  },
  PAUSED: { icon: PauseCircle, className: "bg-muted text-muted-foreground" },
};

/** Due state as icon + words in a tinted chip. Never colour alone. */
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
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs",
        tone,
        className,
      )}
    >
      <Icon className="size-3" aria-hidden="true" />
      {label}
    </span>
  );
}
