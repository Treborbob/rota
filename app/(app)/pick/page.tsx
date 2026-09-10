import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default function PickPage() {
  return (
    <>
      <PageHeader title="Pick" description="Feel like doing something?" />
      <EmptyState
        title="Nothing to pick from yet"
        description="Add some tasks first."
      />
    </>
  );
}
