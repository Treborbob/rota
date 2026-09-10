import { db } from "@/lib/db";

export type Member = {
  id: string;
  name: string;
  image: string | null;
};

export async function listMembers(): Promise<Member[]> {
  const users = await db.user.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, image: true },
  });
  return users;
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
