"use client";

import {
  Check,
  ChevronDown,
  ExternalLink,
  Flame,
  MoveRight,
  Play,
  SkipForward,
  Timer,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { AreaChip } from "@/components/area-chip";
import { FormField } from "@/components/form-field";
import { MemberAvatar } from "@/components/member-avatar";
import { PendingButton } from "@/components/pending-button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useToastAction } from "@/components/use-action-toast";
import type { ActionState } from "@/lib/action-state";
import { updateCompletionMinutes } from "@/lib/completions/actions";
import { elapsedMinutes } from "@/lib/domain/duration";
import { toneForMember } from "@/lib/member-style";
import type { Member } from "@/lib/members";
import {
  cancelStart,
  completePlannedItem,
  movePlannedItem,
  removePlannedItem,
  skipPlannedItem,
  startPlannedItem,
} from "@/lib/planning/actions";
import type { PlanItemView } from "@/lib/planning/queries";
import { cn } from "@/lib/utils";

export type DayOption = { date: string; label: string };

export function PlanItemCard({
  item,
  days,
  members,
  compact = false,
  reason,
}: {
  item: PlanItemView;
  days: DayOption[];
  members: Member[];
  compact?: boolean;
  /** Why it couldn't be placed; shown under the card in the overflow list. */
  reason?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const done = item.state === "COMPLETED";
  const running = !done && item.startedAt !== null;

  function run(action: () => Promise<ActionState>) {
    startTransition(async () => {
      const result = await action();
      if (result?.ok) {
        if (result.message) toast.success(result.message);
      } else if (result?.message) {
        toast.error(result.message);
      }
    });
  }

  return (
    <li
      className={cn(
        "rounded-xl border bg-card",
        done && "opacity-60",
        pending && "opacity-70",
        running && "border-rota-orange/60",
      )}
    >
      <div className="flex items-center gap-1 p-1.5 pr-2">
        <button
          type="button"
          aria-label={done ? `${item.name} is done` : `Mark ${item.name} done`}
          aria-pressed={done}
          disabled={done || pending}
          onClick={() => run(() => completePlannedItem(item.id))}
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
            "disabled:cursor-default",
          )}
        >
          <span
            className={cn(
              "flex size-6 items-center justify-center rounded-md border-2 transition-colors",
              done
                ? "border-rota-orange bg-rota-orange text-primary-foreground"
                : "border-muted-foreground/50 hover:border-rota-orange",
            )}
          >
            {done ? <Check className="size-4" strokeWidth={3} /> : null}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="min-w-0 flex-1">
            <span
              className={cn(
                "line-clamp-2 font-medium leading-tight",
                done && "line-through",
              )}
            >
              {item.name}
              {item.unpleasant ? (
                <Flame
                  className="ml-1 inline size-3.5 text-muted-foreground"
                  aria-label="Unpleasant job"
                />
              ) : null}
            </span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-muted-foreground text-xs">
              <AreaChip area={item.area} />
              {running && item.startedAt ? (
                <Elapsed startedAt={item.startedAt} />
              ) : done && item.completion?.actualMinutes ? (
                <span className="tabular-nums">
                  took {item.completion.actualMinutes} min
                </span>
              ) : (
                <span className="tabular-nums">{item.minutesLabel}</span>
              )}
              {!compact && item.assignedTo ? (
                <span className="inline-flex items-center gap-1">
                  <MemberAvatar
                    name={item.assignedTo.name}
                    tone={toneForMember(members, item.assignedTo.id)}
                    size="xs"
                  />
                  {item.assignedTo.name.split(" ")[0]}
                </span>
              ) : null}
            </span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      </div>

      {reason ? (
        <p className="border-t px-3 py-2 text-muted-foreground text-xs">
          {reason}
        </p>
      ) : null}

      {open ? (
        <div className="space-y-3 border-t px-3 py-3 text-sm">
          <p className="text-muted-foreground">
            {item.dueLabel} · {item.codeLabel}
            {item.manualOverride ? " · placed by hand" : ""}
          </p>
          {item.notes ? (
            <p className="whitespace-pre-wrap leading-relaxed">{item.notes}</p>
          ) : null}

          {done && item.completion ? (
            <AdjustMinutes
              completionId={item.completion.id}
              current={item.completion.actualMinutes}
              estimate={item.minutes}
            />
          ) : null}

          {!done ? (
            <div className="flex flex-wrap gap-2">
              {running ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => run(() => cancelStart(item.id))}
                >
                  <Timer />
                  Cancel timer
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => run(() => startPlannedItem(item.id))}
                >
                  <Play />
                  Start
                </Button>
              )}
              <MoveDialog item={item} days={days} members={members} />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={pending}>
                    <SkipForward />
                    Skip this time
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Skip this occurrence?</AlertDialogTitle>
                    <AlertDialogDescription>
                      The next due date moves on one cycle and nothing is
                      recorded as done.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep it</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => run(() => skipPlannedItem(item.id))}
                    >
                      Skip
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => run(() => removePlannedItem(item.id))}
              >
                <X />
                Not this week
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/tasks/${item.taskId}`}>
                  <ExternalLink />
                  Details
                </Link>
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/** "14 min so far", ticking once a minute. */
function Elapsed({ startedAt }: { startedAt: Date }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="inline-flex items-center gap-1 tabular-nums text-rota-orange">
      <Timer className="size-3" aria-hidden="true" />
      {elapsedMinutes(startedAt, now)} min so far
    </span>
  );
}

/**
 * After Done: "took about 20 min" with nudges. This is where Rota learns real
 * durations, so it is quick and optional rather than a prompt.
 */
function AdjustMinutes({
  completionId,
  current,
  estimate,
}: {
  completionId: string;
  current: number | null;
  estimate: number;
}) {
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState<number>(current ?? estimate);
  const save = (minutes: number) =>
    startTransition(async () => {
      const r = await updateCompletionMinutes(completionId, minutes);
      if (r?.ok) {
        setValue(minutes);
        if (r.message) toast.success(r.message);
      } else if (r?.message) {
        toast.error(r.message);
      }
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-muted-foreground">
        {current === null
          ? `Took about ${estimate} min?`
          : `Took ${current} min.`}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={pending || value <= 5}
        onClick={() => save(Math.max(1, value - 5))}
        aria-label="Five minutes less"
      >
        −5
      </Button>
      <Input
        type="number"
        inputMode="numeric"
        min={1}
        max={600}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        onBlur={() => {
          if (value >= 1 && value !== current) save(value);
        }}
        aria-label="Minutes it took"
        className="h-8 w-20 text-center"
      />
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => save(value + 5)}
        aria-label="Five minutes more"
      >
        +5
      </Button>
      {current === null ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => save(estimate)}
        >
          Yes, about that
        </Button>
      ) : null}
    </div>
  );
}

function MoveDialog({
  item,
  days,
  members,
}: {
  item: PlanItemView;
  days: DayOption[];
  members: Member[];
}) {
  const [open, setOpen] = useState(false);
  const onSuccess = useCallback(() => setOpen(false), []);
  const [state, formAction] = useToastAction(movePlannedItem, onSuccess);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <MoveRight />
          Move
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form action={formAction} className="space-y-5">
          <input type="hidden" name="plannedTaskId" value={item.id} />
          <DialogHeader>
            <DialogTitle>Move or reassign</DialogTitle>
            <DialogDescription>
              {item.name}. Hand-placed items stay put when the week is
              re-planned.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id={`move-day-${item.id}`}
              label="Day"
              error={state?.fieldErrors?.date}
            >
              <NativeSelect
                id={`move-day-${item.id}`}
                name="date"
                defaultValue={item.date ?? days[0]?.date ?? ""}
              >
                {days.map((d) => (
                  <option key={d.date} value={d.date}>
                    {d.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField
              id={`move-who-${item.id}`}
              label="Who"
              error={state?.fieldErrors?.userId}
            >
              <NativeSelect
                id={`move-who-${item.id}`}
                name="userId"
                defaultValue={item.assignedTo?.id ?? members[0]?.id ?? ""}
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name.split(" ")[0]}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <PendingButton pendingLabel="Moving…">Move</PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
