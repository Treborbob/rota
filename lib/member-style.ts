/**
 * Each member gets a colour, in sign-up order: Rob is orange, Hannah is
 * turquoise, anyone after that is violet. Pure; safe in client components.
 */
export type MemberTone = "orange" | "teal" | "violet";

const TONES: MemberTone[] = ["orange", "teal", "violet"];

export function toneForIndex(index: number): MemberTone {
  return TONES[Math.max(0, Math.min(index, TONES.length - 1))];
}

export function toneForMember(
  members: ReadonlyArray<{ id: string }>,
  memberId: string | null | undefined,
): MemberTone {
  const index = members.findIndex((m) => m.id === memberId);
  return toneForIndex(index < 0 ? TONES.length - 1 : index);
}

export const TONE_CLASSES: Record<
  MemberTone,
  { chip: string; text: string; bar: string }
> = {
  orange: {
    chip: "bg-rota-orange-soft text-rota-orange",
    text: "text-rota-orange",
    bar: "bg-rota-orange",
  },
  teal: {
    chip: "bg-rota-teal-soft text-rota-teal",
    text: "text-rota-teal",
    bar: "bg-rota-teal",
  },
  violet: {
    chip: "bg-rota-violet-soft text-rota-violet",
    text: "text-rota-violet",
    bar: "bg-rota-violet",
  },
};

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}
