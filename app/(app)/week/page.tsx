import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default function WeekPage() {
  return (
    <>
      <PageHeader title="Week" description="This week's plan." />
      <EmptyState
        title="No plan yet"
        description="The weekly planner arrives in Phase 2."
      />
    </>
  );
}
