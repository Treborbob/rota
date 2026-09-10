import { HistoryList } from "@/components/history/history-list";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { listCompletions } from "@/lib/completions/queries";
import { isLocalDate } from "@/lib/dates";
import { listMembers } from "@/lib/members";
import { requireUser } from "@/lib/session";
import { listAreas } from "@/lib/tasks/queries";

function str(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" && v.length ? v : undefined;
}

export default async function HistoryPage({
  searchParams,
}: PageProps<"/history">) {
  const user = await requireUser();
  const sp = await searchParams;
  const from = str(sp.from);
  const to = str(sp.to);
  const filters = {
    memberId: str(sp.member),
    areaId: str(sp.area),
    from: from && isLocalDate(from) ? from : undefined,
    to: to && isLocalDate(to) ? to : undefined,
    includeVoided: str(sp.voided) === "1",
  };

  const [rows, members, areas] = await Promise.all([
    listCompletions(filters),
    listMembers(),
    listAreas(true),
  ]);

  return (
    <>
      <PageHeader
        title="History"
        description="What's been done, and by whom."
      />
      <form
        className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6"
        method="get"
      >
        <NativeSelect
          name="member"
          aria-label="Member"
          defaultValue={filters.memberId ?? ""}
        >
          <option value="">Anyone</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          name="area"
          aria-label="Area"
          defaultValue={filters.areaId ?? ""}
        >
          <option value="">Any area</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </NativeSelect>
        <Input
          name="from"
          type="date"
          aria-label="From"
          defaultValue={filters.from ?? ""}
        />
        <Input
          name="to"
          type="date"
          aria-label="To"
          defaultValue={filters.to ?? ""}
        />
        <label className="flex min-h-9 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="voided"
            value="1"
            defaultChecked={filters.includeVoided}
            className="accent-primary"
          />
          Show removed
        </label>
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>
      <HistoryList rows={rows} currentUserId={user.id} />
    </>
  );
}
