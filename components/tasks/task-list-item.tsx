import { ChevronRight, Flame } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { AreaChip } from "@/components/area-chip";
import { DueBadge } from "@/components/tasks/due-badge";
import type { TaskView } from "@/lib/tasks/view";

export function TaskListItem({
  task,
  trailing,
}: {
  task: TaskView;
  trailing?: ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Link
        href={`/tasks/${task.id}`}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4"
      >
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate font-medium leading-tight">
            {task.name}
            {task.unpleasant ? (
              <Flame
                className="ml-1 inline size-3.5 text-muted-foreground"
                aria-label="Unpleasant job"
              />
            ) : null}
          </p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs">
            <AreaChip area={task.area} />
            <span className="tabular-nums">{task.minutesLabel}</span>
            <span aria-hidden="true">·</span>
            <span>{task.assignmentLabel}</span>
          </div>
        </div>
        <DueBadge
          state={task.dueState}
          label={task.dueLabel}
          className="shrink-0"
        />
        {!trailing ? (
          <ChevronRight
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        ) : null}
      </Link>
      {trailing}
    </li>
  );
}
