import { AreaManager } from "@/components/areas/area-manager";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/session";
import { listAreas, listTasks } from "@/lib/tasks/queries";

export default async function AreasPage() {
  await requireUser();
  const [areas, tasks] = await Promise.all([
    listAreas(true),
    listTasks({ status: "active" }),
  ]);

  const rows = areas.map((area) => {
    const inArea = tasks.filter((t) => t.area.id === area.id);
    return {
      id: area.id,
      name: area.name,
      icon: area.icon,
      colour: area.colour,
      active: area.active,
      taskCount: inArea.length,
      dueCount: inArea.filter((t) =>
        ["OVERDUE", "DUE", "DUE_SOON"].includes(t.dueState.kind),
      ).length,
      overdueCount: inArea.filter((t) => t.dueState.kind === "OVERDUE").length,
    };
  });

  return (
    <>
      <PageHeader title="Areas" description="Rooms and zones of the house." />
      <AreaManager areas={rows} />
    </>
  );
}
