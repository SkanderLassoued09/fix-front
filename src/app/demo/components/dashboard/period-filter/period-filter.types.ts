/**
 * Shared period-filter contract. The dashboard owns the current selection
 * and passes a flat `{ startDate, endDate, granularity }` triple to every
 * GraphQL query so the backend can apply the same date window everywhere.
 */
export type PeriodPreset = 'TODAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'CUSTOM';
export type TrendGranularity = 'DAY' | 'WEEK' | 'MONTH';

export interface PeriodSelection {
  preset: PeriodPreset;
  startDate: Date;
  endDate: Date;
  /** Bucket size for the trend chart when this period is the active one. */
  granularity: TrendGranularity;
  label: string;
}

/**
 * Compute the canonical start/end/granularity for a preset. Uses local time
 * boundaries so a user picking "Aujourd'hui" gets the day in their wall clock.
 */
export function buildPeriodFromPreset(preset: PeriodPreset): PeriodSelection {
  const now = new Date();
  switch (preset) {
    case 'TODAY': {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      return {
        preset,
        startDate: start,
        endDate: end,
        granularity: 'DAY',
        label: "Aujourd'hui",
      };
    }
    case 'WEEK': {
      const start = new Date(now);
      // ISO week starts Monday
      const day = start.getDay();
      const offset = day === 0 ? 6 : day - 1;
      start.setDate(start.getDate() - offset);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      return {
        preset,
        startDate: start,
        endDate: end,
        granularity: 'DAY',
        label: 'Cette semaine',
      };
    }
    case 'MONTH': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      return {
        preset,
        startDate: start,
        endDate: end,
        granularity: 'WEEK',
        label: 'Ce mois',
      };
    }
    case 'YEAR': {
      const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      return {
        preset,
        startDate: start,
        endDate: end,
        granularity: 'MONTH',
        label: 'Cette année',
      };
    }
    case 'CUSTOM':
    default: {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      return {
        preset: 'CUSTOM',
        startDate: start,
        endDate: end,
        granularity: 'WEEK',
        label: 'Personnalisé',
      };
    }
  }
}

/**
 * Pick a reasonable granularity for an arbitrary custom range so the trend
 * chart doesn't show 365 bars when someone picks "this year" in custom mode.
 */
export function granularityForRange(
  startDate: Date,
  endDate: Date,
): TrendGranularity {
  const ms = endDate.getTime() - startDate.getTime();
  const days = ms / (1000 * 60 * 60 * 24);
  if (days <= 35) return 'DAY';
  if (days <= 120) return 'WEEK';
  return 'MONTH';
}
