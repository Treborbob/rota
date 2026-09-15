"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { type DurationStats, describeDurations } from "@/lib/domain/duration";
import { updateTaskEstimate } from "@/lib/tasks/actions";

/** "Estimate 20 min. Actually 25–35, typically 30. [Use 30 min]" */
export function DurationStatsLine({
  taskId,
  estimate,
  stats,
  planningMinutes,
}: {
  taskId: string;
  estimate: number;
  stats: DurationStats | null;
  planningMinutes: number;
}) {
  const [pending, startTransition] = useTransition();
  if (!stats) {
    return (
      <p className="text-muted-foreground text-sm">
        No recorded times yet. Tap Start before a job, or adjust the time after
        marking it done, and Rota will learn how long it really takes.
      </p>
    );
  }
  const learned = planningMinutes !== estimate;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      <span>{describeDurations(stats)}.</span>
      {learned ? (
        <span className="text-muted-foreground">
          The planner already uses {planningMinutes} min.
        </span>
      ) : null}
      {stats.typical !== estimate ? (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await updateTaskEstimate(taskId, stats.typical);
              if (r?.ok) toast.success(r.message ?? "Updated.");
              else if (r?.message) toast.error(r.message);
            })
          }
        >
          Use {stats.typical} min as the estimate
        </Button>
      ) : null}
    </div>
  );
}
