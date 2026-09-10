"use client";

import {
  Check,
  ChevronDown,
  ExternalLink,
  Flame,
  MoveRight,
  SkipForward,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { AreaChip } from "@/components/area-chip";
import { FormField } from "@/components/form-field";
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
import { NativeSelect } from "@/components/ui/native-select";
import { useToastAction } from "@/components/use-action-toast";
import type { ActionState } from "@/lib/action-state";
import type { Member } from "@/lib/members";
import {
  completePlannedItem,
  movePlannedItem,
  removePlannedItem,
  skipPlannedItem,
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
        "rounded-lg border bg-card",
        done && "opacity-60",
        pending && "opacity-70",
      )}
    >
      <div className="flex items-center gap-2 p-2 pl-3">
        <Button
          size={compact ? "icon" : "icon-lg"}
          variant={done ? "secondary" : "default"}
          aria-label={done ? `${item.name} is done` : `Mark ${item.name} done`}
          aria-pressed={done}
          disabled={done || pending}
          onClick={() => run(() => completePlannedItem(item.id))}
          className="shrink-0 rounded-full"
        >
          <Check />
        </Button>
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
              <span className="tabular-nums">{item.minutesLabel}</span>
              {!compact && item.assignedTo ? (
                <span>· {item.assignedTo.name.split(" ")[0]}</span>
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
          {!done ? (
            <div className="flex flex-wrap gap-2">
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
