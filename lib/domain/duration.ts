/**
 * Learning how long a job really takes. Pure.
 *
 * The estimate on a task is a guess. Once a few completions carry a recorded
 * duration, the "typical" figure (the median, so one disastrous oven session
 * doesn't drag it) is a better number to plan with.
 */

/** Recorded durations needed before we trust them over the estimate. */
export const MIN_SAMPLES = 3;

/** How many recent recordings to look at; older habits shouldn't linger. */
export const MAX_SAMPLES = 10;

export type DurationStats = {
  count: number;
  min: number;
  max: number;
  /** Median, rounded to the nearest minute. */
  typical: number;
};

export function summariseDurations(samples: number[]): DurationStats | null {
  const valid = samples.filter((n) => Number.isFinite(n) && n > 0);
  if (valid.length === 0) return null;
  const sorted = [...valid].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return {
    count: sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    typical: Math.round(median),
  };
}

/**
 * The minutes the planner should use: the typical recorded duration once
 * there are enough samples, otherwise the estimate.
 */
export function effectiveMinutes(
  estimate: number,
  samples: number[],
  minSamples = MIN_SAMPLES,
): { minutes: number; learned: boolean } {
  const stats = summariseDurations(samples);
  if (stats && stats.count >= minSamples) {
    return { minutes: stats.typical, learned: true };
  }
  return { minutes: estimate, learned: false };
}

/** "Actually 25–35 min, typically 30" / "Actually 30 min" (all the same). */
export function describeDurations(stats: DurationStats): string {
  if (stats.min === stats.max) {
    return `Actually ${stats.min} min, ${stats.count} time${stats.count === 1 ? "" : "s"}`;
  }
  return `Actually ${stats.min}–${stats.max} min, typically ${stats.typical}`;
}

/** Whole minutes between two instants, never less than 1. */
export function elapsedMinutes(startedAt: Date, endedAt: Date): number {
  return Math.max(
    1,
    Math.round((endedAt.getTime() - startedAt.getTime()) / 60_000),
  );
}
