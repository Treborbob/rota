import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { CompleteDialog } from "@/components/tasks/complete-dialog";
import { TaskListItem } from "@/components/tasks/task-list-item";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { requireUser } from "@/lib/session";
import { listAreas, listTasks } from "@/lib/tasks/queries";
import type { TaskView } from "@/lib/tasks/view";

function str(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" && v.length ? v : undefined;
}

const GROUPS: Array<{ kinds: TaskView["dueState"]["kind"][]; title: string }> =
  [
    { kinds: ["OVERDUE"], title: "Overdue" },
    { kinds: ["DUE"], title: "Due today" },
    { kinds: ["DUE_SOON"], title: "Due soon" },
    { kinds: ["ANYTIME"], title: "Whenever" },
    { kinds: ["NOT_DUE"], title: "Not due yet, but you could" },
  ];

export default async function PickPage({ searchParams }: PageProps<"/pick">) {
  const user = await requireUser();
  const sp = await searchParams;
  const quick = str(sp.quick) === "1";
  const nice = str(sp.nice) === "1";
  const others = str(sp.others) === "1";
  const areaId = str(sp.area);

  const [all, areas] = await Promise.all([
    listTasks({ status: "active", areaId }),
    listAreas(),
  ]);

  const tasks = all.filter((t) => {
    if (t.dueState.kind === "DEFERRED") return false;
    if (quick && t.estimatedMinutes > 15) return false;
    if (nice && t.unpleasant) return false;
    if (
      !others &&
      t.assignmentMode === "FIXED" &&
      t.fixedAssignee?.id !== user.id
    ) {
      return false;
    }
    return true;
  });

  return (
    <>
      <PageHeader
        title="Pick"
        description="Feel like doing something? Here's what's on the list."
      />
      <form
        method="get"
        className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm"
      >
        <label className="flex min-h-9 items-center gap-2">
          <input
            type="checkbox"
            name="quick"
            value="1"
            defaultChecked={quick}
            className="accent-primary"
          />
          Quick (15 min or less)
        </label>
        <label className="flex min-h-9 items-center gap-2">
          <input
            type="checkbox"
            name="nice"
            value="1"
            defaultChecked={nice}
            className="accent-primary"
          />
          Nothing unpleasant
        </label>
        <label className="flex min-h-9 items-center gap-2">
          <input
            type="checkbox"
            name="others"
            value="1"
            defaultChecked={others}
            className="accent-primary"
          />
          Include the other person's jobs
        </label>
        <NativeSelect
          name="area"
          aria-label="Area"
          defaultValue={areaId ?? ""}
          className="w-44"
        >
          <option value="">Any area</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" variant="outline" size="sm">
          Update
        </Button>
      </form>

      {tasks.length === 0 ? (
        <EmptyState
          title="Nothing fits"
          description="Loosen the filters, or enjoy the afternoon."
        />
      ) : (
        <div className="space-y-6">
          {GROUPS.map(({ kinds, title }) => {
            const group = tasks.filter((t) => kinds.includes(t.dueState.kind));
            if (group.length === 0) return null;
            const collapsed = kinds.includes("NOT_DUE");
            const list = (
              <ul key={title} className="divide-y rounded-xl border">
                {group.map((task) => (
                  <TaskListItem
                    key={task.id}
                    task={task}
                    trailing={
                      <CompleteDialog
                        taskId={task.id}
                        taskName={task.name}
                        estimatedMinutes={task.estimatedMinutes}
                        source="PICK"
                        size="sm"
                        variant="outline"
                      />
                    }
                  />
                ))}
              </ul>
            );
            return collapsed ? (
              <details key={title} className="group">
                <summary className="mb-2 cursor-pointer font-medium text-sm">
                  {title} ({group.length})
                </summary>
                {list}
              </details>
            ) : (
              <section key={title}>
                <h3 className="mb-2 font-medium text-sm">{title}</h3>
                {list}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
