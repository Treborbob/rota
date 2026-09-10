"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { Member } from "@/lib/members";

type Area = { id: string; name: string };

export function TaskFilters({
  areas,
  members,
}: {
  areas: Area[];
  members: Member[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    });
  }

  return (
    <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      <div className="relative sm:col-span-2 lg:col-span-1">
        <label htmlFor="task-search" className="sr-only">
          Search tasks
        </label>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id="task-search"
          type="search"
          placeholder="Search"
          defaultValue={params.get("q") ?? ""}
          onChange={(e) => set("q", e.target.value)}
          className="h-9 pl-8 md:h-8"
        />
      </div>
      <NativeSelect
        aria-label="Area"
        value={params.get("area") ?? ""}
        onChange={(e) => set("area", e.target.value)}
      >
        <option value="">Any area</option>
        {areas.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect
        aria-label="Assignee"
        value={params.get("assignee") ?? ""}
        onChange={(e) => set("assignee", e.target.value)}
      >
        <option value="">Anyone</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            Always {m.name.split(" ")[0]}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect
        aria-label="Due"
        value={params.get("due") ?? ""}
        onChange={(e) => set("due", e.target.value)}
      >
        <option value="">Any due state</option>
        <option value="overdue">Overdue</option>
        <option value="due">Due now</option>
        <option value="soon">Due soon</option>
      </NativeSelect>
      <NativeSelect
        aria-label="Status"
        value={params.get("status") ?? "active"}
        onChange={(e) => set("status", e.target.value)}
      >
        <option value="active">Active</option>
        <option value="paused">Paused</option>
        <option value="archived">Archived</option>
      </NativeSelect>
    </div>
  );
}
