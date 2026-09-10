"use client";

import { useCallback } from "react";
import { PendingButton } from "@/components/pending-button";
import { Input } from "@/components/ui/input";
import { useToastAction } from "@/components/use-action-toast";
import type { ActionState } from "@/lib/action-state";
import { WEEKDAY_LABELS } from "@/lib/capacity";
import { updateWeekdayCapacity } from "@/lib/settings/actions";

export function CapacityForm({
  userId,
  name,
  minutes,
}: {
  userId: string;
  name: string;
  /** Seven values, Monday first. */
  minutes: number[];
}) {
  const action = useCallback(
    (prev: ActionState, fd: FormData) =>
      updateWeekdayCapacity(userId, prev, fd),
    [userId],
  );
  const [state, formAction] = useToastAction(action);

  return (
    <form action={formAction} className="rounded-xl border">
      <h3 className="border-b px-4 py-3 font-medium">
        {name}'s minutes per evening
      </h3>
      <div className="grid grid-cols-7 gap-1 px-3 py-3">
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={label} className="flex flex-col items-center gap-1 text-xs">
            <label
              htmlFor={`cap-${userId}-${i + 1}`}
              className="text-muted-foreground"
            >
              {label.slice(0, 3)}
            </label>
            <Input
              id={`cap-${userId}-${i + 1}`}
              name={`d${i + 1}`}
              type="number"
              inputMode="numeric"
              min={0}
              max={600}
              defaultValue={minutes[i] ?? 0}
              aria-label={`${name}, ${label}`}
              className="h-9 px-1 text-center md:h-8"
            />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 border-t px-4 py-3">
        <p className="text-muted-foreground text-xs">
          {state && !state.ok && state.message
            ? state.message
            : "Zero means an evening off."}
        </p>
        <PendingButton size="sm" pendingLabel="Saving…">
          Save
        </PendingButton>
      </div>
    </form>
  );
}
