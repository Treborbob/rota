"use client";

import {
  CalendarDays,
  ClipboardList,
  Ellipsis,
  Sparkles,
  Sun,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/logo";
import { MemberAvatar } from "@/components/member-avatar";
import type { MemberTone } from "@/lib/member-style";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Tonight", icon: Sun },
  { href: "/week", label: "Week", icon: CalendarDays },
  { href: "/tasks", label: "Tasks", icon: ClipboardList },
  { href: "/pick", label: "Pick", icon: Sparkles },
  { href: "/more", label: "More", icon: Ellipsis },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export type NavUser = { name: string; tone: MemberTone };

/** Bottom tab bar on phones. */
export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="flex">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-[-2px]",
                  active
                    ? "font-medium text-rota-orange"
                    : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Sidebar from md upwards: mark, nav, who's signed in. */
export function Sidebar({
  user,
  householdName,
}: {
  user: NavUser;
  householdName: string;
}) {
  const pathname = usePathname();
  return (
    <aside className="hidden h-dvh w-60 shrink-0 flex-col border-r bg-sidebar md:sticky md:top-0 md:flex">
      <div className="px-5 pt-6 pb-4">
        <Link
          href="/"
          className="inline-flex rounded-lg focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4"
        >
          <Wordmark />
        </Link>
      </div>
      <nav aria-label="Main" className="flex-1 px-3">
        <ul className="space-y-1">
          {ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-lg px-3 text-[0.95rem] transition-colors",
                    "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-[-2px]",
                    active
                      ? "bg-accent font-medium text-rota-orange"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  )}
                >
                  <Icon className="size-[18px]" aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t px-5 py-4">
        <Link
          href="/more"
          className="flex items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4"
        >
          <MemberAvatar name={user.name} tone={user.tone} size="lg" />
          <span className="min-w-0">
            <span className="block truncate font-medium text-sm">
              {user.name}
            </span>
            <span className="block truncate text-muted-foreground text-xs">
              {householdName}
            </span>
          </span>
        </Link>
      </div>
    </aside>
  );
}

/** Compact brand row shown above the content on phones. */
export function MobileBrand() {
  return (
    <div className="mb-5 md:hidden">
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4"
      >
        <Wordmark className="[&>span:last-child]:text-rota-orange [&>svg]:size-8" />
      </Link>
    </div>
  );
}
