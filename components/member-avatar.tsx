import { initials, type MemberTone, TONE_CLASSES } from "@/lib/member-style";
import { cn } from "@/lib/utils";

export function MemberAvatar({
  name,
  tone,
  size = "md",
  className,
}: {
  name: string;
  tone: MemberTone;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    xs: "size-4 text-[9px]",
    sm: "size-6 text-[10px]",
    md: "size-8 text-xs",
    lg: "size-11 text-sm",
  }[size];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold tabular-nums",
        TONE_CLASSES[tone].chip,
        sizes,
        className,
      )}
    >
      {size === "xs" ? initials(name)[0] : initials(name)}
    </span>
  );
}
