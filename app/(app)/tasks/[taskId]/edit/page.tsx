import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { TaskForm } from "@/components/tasks/task-form";
import { listMembers } from "@/lib/members";
import { requireUser } from "@/lib/session";
import { updateTask } from "@/lib/tasks/actions";
import { getTask, listAreas } from "@/lib/tasks/queries";

export const metadata = { title: "Edit task" };

export default async function EditTaskPage({
  params,
}: PageProps<"/tasks/[taskId]/edit">) {
  await requireUser();
  const { taskId } = await params;
  const [task, areas, members] = await Promise.all([
    getTask(taskId),
    listAreas(),
    listMembers(),
  ]);
  if (!task) notFound();

  const action = updateTask.bind(null, task.id);

  return (
    <>
      <PageHeader title="Edit task" description={task.name} />
      <TaskForm
        areas={areas}
        members={members}
        initial={task}
        action={action}
        submitLabel="Save changes"
        cancelHref={`/tasks/${task.id}`}
      />
    </>
  );
}
