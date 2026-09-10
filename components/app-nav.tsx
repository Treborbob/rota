"use client";

import {
  CalendarDays,
  ClipboardList,
  Ellipsis,
  Moon,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Tonight", icon: Moon },
  { href: "/week", label: "Week", icon: CalendarDays },
  { href: "/tasks", label: "Tasks", icon: ClipboardList },
  { href: "/pick", label: "Pick", icon: Sparkles },
  { href: "/more", label: "More", icon: Ellipsis },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Bottom tab bar on small screens, sidebar from md upwards. */
export function AppNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur",
        "pb-[env(safe-area-inset-bottom)]",
        "md:static md:inset-auto md:h-full md:w-56 md:border-t-0 md:border-r md:pb-0",
      )}
    >
      <ul className="flex md:flex-col md:gap-1 md:p-3">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="flex-1 md:flex-none">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs",
                  "md:min-h-11 md:flex-row md:justify-start md:gap-3 md:rounded-md md:px-3 md:text-sm",
                  "transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-[-2px]",
                  active
                    ? "text-foreground md:bg-accent md:font-medium"
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
