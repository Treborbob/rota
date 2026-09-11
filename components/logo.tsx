import { cn } from "@/lib/utils";

/** The two-tone mark: orange for Rob, turquoise for Hannah, one loop. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={cn("size-9 shrink-0", className)}
    >
      <defs>
        <clipPath id="rota-mark-clip">
          <rect width="64" height="64" rx="16" />
        </clipPath>
      </defs>
      <g clipPath="url(#rota-mark-clip)">
        <rect width="64" height="64" fill="#e0a36a" />
        <path d="M64 0 C 50 15, 37 25, 0 64 L64 64 Z" fill="#6fb5ad" />
      </g>
      <g
        transform="translate(14 14) scale(1.5)"
        fill="none"
        stroke="#fff7ed"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
      </g>
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="font-semibold text-lg tracking-tight">Rota</span>
    </span>
  );
}
