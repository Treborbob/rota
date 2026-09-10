import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { TaskFilters } from "@/components/tasks/task-filters";
import { TaskListItem } from "@/components/tasks/task-list-item";
import { Button } from "@/components/ui/button";
import { listMembers } from "@/lib/members";
import { requireUser } from "@/lib/session";
import {
  listAreas,
  listTasks,
  type TaskListFilters,
} from "@/lib/tasks/queries";

function str(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" && v.length ? v : undefined;
}

export default async function TasksPage({ searchParams }: PageProps<"/tasks">) {
  await requireUser();
  const sp = await searchParams;
  const filters: TaskListFilters = {
    q: str(sp.q),
    areaId: str(sp.area),
    assigneeId: str(sp.assignee),
    due: str(sp.due) as TaskListFilters["due"],
    status: (str(sp.status) as TaskListFilters["status"]) ?? "active",
  };

  const [tasks, areas, members] = await Promise.all([
    listTasks(filters),
    listAreas(),
    listMembers(),
  ]);

  const filtered =
    filters.q || filters.areaId || filters.assigneeId || filters.due;

  return (
    <>
      <PageHeader
        title="Tasks"
        description={`${tasks.length} ${filters.status === "active" ? "active" : filters.status}`}
        actions={
          <Button asChild>
            <Link href="/tasks/new">
              <Plus />
              New task
            </Link>
          </Button>
        }
      />
      <Suspense>
        <TaskFilters areas={areas} members={members} />
      </Suspense>
      {tasks.length === 0 ? (
        <EmptyState
          title={filtered ? "Nothing matches" : "No tasks yet"}
          description={
            filtered
              ? "Try loosening the filters."
              : "Add the first few jobs the house needs doing."
          }
          action={
            filtered ? null : (
              <Button asChild>
                <Link href="/tasks/new">
                  <Plus />
                  Add a task
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <ul className="divide-y rounded-xl border">
          {tasks.map((task) => (
            <TaskListItem key={task.id} task={task} />
          ))}
        </ul>
      )}
    </>
  );
}
