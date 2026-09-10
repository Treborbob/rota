import { PageHeader } from "@/components/page-header";
import { TaskForm } from "@/components/tasks/task-form";
import { listMembers } from "@/lib/members";
import { requireUser } from "@/lib/session";
import { createTask } from "@/lib/tasks/actions";
import { listAreas } from "@/lib/tasks/queries";

export const metadata = { title: "New task" };

export default async function NewTaskPage() {
  await requireUser();
  const [areas, members] = await Promise.all([listAreas(), listMembers()]);

  return (
    <>
      <PageHeader title="New task" />
      <TaskForm
        areas={areas}
        members={members}
        action={createTask}
        submitLabel="Add task"
        cancelHref="/tasks"
      />
    </>
  );
}
