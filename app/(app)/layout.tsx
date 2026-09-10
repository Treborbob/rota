import { AddToHomeHint } from "@/components/add-to-home-hint";
import { AppNav } from "@/components/app-nav";
import { requireUser } from "@/lib/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Authoritative check; the proxy only does an optimistic cookie test.
  await requireUser();

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <header className="sr-only">
        <h1>Rota</h1>
      </header>
      <div className="hidden md:block">
        <AppNav />
      </div>
      <main className="flex-1 pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8 md:py-10">
          <AddToHomeHint />
          {children}
        </div>
      </main>
      <div className="md:hidden">
        <AppNav />
      </div>
    </div>
  );
}
