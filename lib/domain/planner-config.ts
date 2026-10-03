/**
 * Every tunable number in the planner, in one place, versioned.
 * Change a value here and bump ALGORITHM_VERSION so old plans stay explicable.
 */
/**
 * v2: nothing due after the week is pulled forward into spare time.
 * v3: a task goes on its due day or the nearest evening after, never earlier.
 * v4: missed and pushed work goes to the next day its owner isn't away,
 *     whatever that day's budget, across weekends and into the next week.
 * v5: a preferred weekday only chooses among evenings on or after the due
 *     date; it no longer pulls a task earlier.
 */
export const ALGORITHM_VERSION = "v5";

export const PLANNER_WEIGHTS = {
  priority: {
    LOW: 100,
    NORMAL: 300,
    HIGH: 600,
    ESSENTIAL: 1000,
  },
  /** Added per day overdue. */
  overduePerDay: 20,
  /** Added per day inside the due-soon window. */
  dueSoonPerDay: 5,
  /** Added when a person has explicitly put the task in this week. */
  manualPin: 10_000,
  /** Fraction of the previous 28 days' completed minutes counted as load. */
  recentLoadFactor: 0.25,
  /** Tasks at or above this many minutes count as heavy. */
  heavyMinutes: 30,
  /** Utilisation-ratio penalty for stacking a second heavy task on one night. */
  heavyStackPenalty: 0.35,
} as const;

export type PlannerWeights = typeof PLANNER_WEIGHTS;
