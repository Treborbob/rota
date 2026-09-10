import { ChevronRight, History, LayoutGrid, Settings } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { SignOutButton } from "@/components/sign-out-button";
import { requireUser } from "@/lib/session";

const LINKS = [
  { href: "/areas", label: "Areas", icon: LayoutGrid },
  { href: "/history", label: "History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export default async function MorePage() {
  const user = await requireUser();

  return (
    <>
      <PageHeader title="More" />
      <ul className="divide-y rounded-xl border">
        {LINKS.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex min-h-14 items-center gap-3 px-4 hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
            >
              <Icon
                className="size-5 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="flex-1">{label}</span>
              <ChevronRight
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex items-center justify-between gap-4 rounded-xl border px-4 py-4">
        <div className="min-w-0">
          <p className="truncate font-medium">{user.name}</p>
          <p className="truncate text-muted-foreground text-sm">{user.email}</p>
        </div>
        <SignOutButton />
      </div>
    </>
  );
}
