"use client";

import { useCallback, useState } from "react";
import { FormField } from "@/components/form-field";
import { PendingButton } from "@/components/pending-button";
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
import { useToastAction } from "@/components/use-action-toast";
import { setCapacityOverride } from "@/lib/planning/actions";
import type { PlanMemberDay } from "@/lib/planning/queries";
import { cn } from "@/lib/utils";

/**
 * "Rob · 30 min" with a utilisation bar. Tap to say "out tonight" or
 * "only 15 minutes", which re-plans the week around it.
 */
export function CapacityChip({
  member,
  date,
  dateLabel,
}: {
  member: PlanMemberDay;
  date: string;
  dateLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const onSuccess = useCallback(() => setOpen(false), []);
  const [state, formAction] = useToastAction(setCapacityOverride, onSuccess);
  const over = member.capacity > 0 && member.planned > member.capacity;
  const ratio =
    member.capacity > 0 ? Math.min(1, member.planned / member.capacity) : 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex min-h-9 w-full items-center gap-2 rounded-md px-1.5 text-left text-xs hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring",
            member.overridden && "italic",
          )}
          aria-label={`${member.name}, ${member.planned} of ${member.capacity} minutes on ${dateLabel}. Change availability.`}
        >
          <span className="w-14 shrink-0 truncate font-medium">
            {member.name}
          </span>
          <span
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
            aria-hidden="true"
          >
            <span
              className={cn(
                "block h-full rounded-full",
                over ? "bg-orange-500" : "bg-primary",
              )}
              style={{ width: `${ratio * 100}%` }}
            />
          </span>
          <span className="w-16 shrink-0 text-right tabular-nums text-muted-foreground">
            {member.capacity === 0
              ? "off"
              : `${member.planned}/${member.capacity}`}
          </span>
        </button>
      </DialogTrigger>
      <DialogContent>
        <form action={formAction} className="space-y-5">
          <input type="hidden" name="userId" value={member.userId} />
          <input type="hidden" name="date" value={date} />
          <DialogHeader>
            <DialogTitle>
              {member.name} on {dateLabel}
            </DialogTitle>
            <DialogDescription>
              Usually {member.defaultCapacity} min. Set 0 for "out". The week is
              re-planned around it; finished and hand-placed work stays.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id={`cap-${member.userId}-${date}`}
              label="Minutes"
              error={state?.fieldErrors?.minutes}
            >
              <Input
                id={`cap-${member.userId}-${date}`}
                name="minutes"
                type="number"
                inputMode="numeric"
                min={0}
                max={600}
                defaultValue={member.capacity}
              />
            </FormField>
            <FormField id={`note-${member.userId}-${date}`} label="Note">
              <Input
                id={`note-${member.userId}-${date}`}
                name="note"
                defaultValue={member.note ?? ""}
                placeholder="Out with friends"
                maxLength={120}
              />
            </FormField>
          </div>
          <DialogFooter>
            {member.overridden ? (
              <PendingButton
                variant="ghost"
                name="reset"
                value="1"
                pendingLabel="Resetting…"
              >
                Back to usual
              </PendingButton>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <PendingButton pendingLabel="Re-planning…">Save</PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
