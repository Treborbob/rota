import { AddToHomeHint } from "@/components/add-to-home-hint";
import { MobileBrand, Sidebar, TabBar } from "@/components/app-nav";
import { db } from "@/lib/db";
import { toneForMember } from "@/lib/member-style";
import { listMembers } from "@/lib/members";
import { requireUser } from "@/lib/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Authoritative check; the proxy only does an optimistic cookie test.
  const user = await requireUser();
  const [members, household] = await Promise.all([
    listMembers(),
    db.household.findFirst({ select: { name: true } }),
  ]);
  const navUser = { name: user.name, tone: toneForMember(members, user.id) };

  return (
    <div className="flex min-h-dvh">
      <Sidebar user={navUser} householdName={household?.name ?? "Rota"} />
      <main className="min-w-0 flex-1 pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <div className="mx-auto w-full max-w-4xl px-4 pt-5 pb-6 md:px-10 md:py-10">
          <MobileBrand />
          <AddToHomeHint />
          {children}
        </div>
      </main>
      <TabBar />
    </div>
  );
}
