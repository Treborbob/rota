import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default function HistoryPage() {
  return (
    <>
      <PageHeader
        title="History"
        description="What's been done, and by whom."
      />
      <EmptyState title="Nothing done yet" />
    </>
  );
}
