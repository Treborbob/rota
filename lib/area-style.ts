/** Restrained area colours: a tinted chip, readable in both themes. */
export const AREA_COLOURS: Record<string, string> = {
  amber: "bg-amber-100 text-amber-950 dark:bg-amber-500/20 dark:text-amber-100",
  rose: "bg-rose-100 text-rose-950 dark:bg-rose-500/20 dark:text-rose-100",
  stone: "bg-stone-200 text-stone-900 dark:bg-stone-500/25 dark:text-stone-100",
  violet:
    "bg-violet-100 text-violet-950 dark:bg-violet-500/20 dark:text-violet-100",
  indigo:
    "bg-indigo-100 text-indigo-950 dark:bg-indigo-500/20 dark:text-indigo-100",
  sky: "bg-sky-100 text-sky-950 dark:bg-sky-500/20 dark:text-sky-100",
  teal: "bg-teal-100 text-teal-950 dark:bg-teal-500/20 dark:text-teal-100",
  lime: "bg-lime-100 text-lime-950 dark:bg-lime-500/20 dark:text-lime-100",
  orange:
    "bg-orange-100 text-orange-950 dark:bg-orange-500/20 dark:text-orange-100",
  emerald:
    "bg-emerald-100 text-emerald-950 dark:bg-emerald-500/20 dark:text-emerald-100",
};

export const AREA_COLOUR_KEYS = Object.keys(AREA_COLOURS);

export function areaColourClass(colour: string | null | undefined): string {
  return (colour && AREA_COLOURS[colour]) || "bg-muted text-foreground";
}
