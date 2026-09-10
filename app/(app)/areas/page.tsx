import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";

export default async function AreasPage() {
  const areas = await db.area.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <>
      <PageHeader title="Areas" description="Rooms and zones of the house." />
      <ul className="divide-y rounded-xl border">
        {areas.map((area) => (
          <li key={area.id} className="flex min-h-12 items-center px-4">
            {area.name}
          </li>
        ))}
      </ul>
    </>
  );
}
