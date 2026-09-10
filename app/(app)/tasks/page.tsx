import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default function TasksPage() {
  return (
    <>
      <PageHeader title="Tasks" description="Everything the house needs." />
      <EmptyState
        title="No tasks yet"
        description="Task management arrives in Phase 1."
      />
    </>
  );
}
