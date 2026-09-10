"use client";

import { Plus, RefreshCw } from "lucide-react";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { addTaskToWeek, regeneratePlan } from "@/lib/planning/actions";

type Addable = {
  id: string;
  name: string;
  estimatedMinutes: number;
  dueLabel: string;
};

export function RegenerateButton({ weekStart }: { weekStart: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await regeneratePlan(weekStart);
          if (r?.ok) toast.success(r.message ?? "Re-planned.");
          else if (r?.message) toast.error(r.message);
        })
      }
    >
      <RefreshCw className={pending ? "animate-spin" : ""} />
      Re-plan
    </Button>
  );
}

export function AddToWeekDialog({
  weekStart,
  tasks,
}: {
  weekStart: string;
  tasks: Addable[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const add = useCallback(
    (taskId: string) =>
      startTransition(async () => {
        const r = await addTaskToWeek(weekStart, taskId);
        if (r?.ok) {
          toast.success(r.message ?? "Added.");
          setOpen(false);
        } else if (r?.message) {
          toast.error(r.message);
        }
      }),
    [weekStart],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus />
          Add a task
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add to this week</DialogTitle>
          <DialogDescription>
            The planner finds it a slot, or tells you why it can't.
          </DialogDescription>
        </DialogHeader>
        {tasks.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Everything active is already in the week.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {tasks.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => add(t.id)}
                  className="flex min-h-12 w-full items-center gap-3 px-3 text-left text-sm hover:bg-accent disabled:opacity-50"
                >
                  <span className="min-w-0 flex-1 truncate">{t.name}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {t.estimatedMinutes} min
                  </span>
                  <span className="shrink-0 text-muted-foreground text-xs">
                    {t.dueLabel}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
