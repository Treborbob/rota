import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { formatLocalDate, todayLocal } from "@/lib/dates";
import { requireUser } from "@/lib/session";

export default async function TonightPage() {
  const user = await requireUser();
  const today = todayLocal();

  return (
    <>
      <PageHeader
        title="Tonight"
        description={formatLocalDate(today, "EEEE d MMMM")}
      />
      <EmptyState
        title={`Nothing planned yet, ${user.name.split(" ")[0]}.`}
        description="Tonight's list appears here once the planner is built."
      />
    </>
  );
}
