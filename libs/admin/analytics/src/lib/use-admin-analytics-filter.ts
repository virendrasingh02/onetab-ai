import { useDateRangeParam } from '@org/hooks';
import type { AdminAnalyticsFilter } from '@org/types';
import {
  DEFAULT_DATE_RANGE,
  isSameDateRange,
  toDateRangeQuery,
  type DateRangeValue,
} from '@org/utils';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

type PlatformFilter = NonNullable<AdminAnalyticsFilter['platform']>;

export interface AdminAnalyticsFilterState {
  /** What the analytics endpoints receive — always explicit calendar days. */
  filter: AdminAnalyticsFilter;
  range: DateRangeValue;
  setRange: (next: DateRangeValue) => void;
  platform: PlatformFilter;
  setPlatform: (next: PlatformFilter) => void;
  reset: () => void;
  isFiltered: boolean;
}

/**
 * The one filter every admin analytics screen reads, backed by the URL so a
 * reload or a shared link reproduces the same view. Each screen used to keep
 * its own `useState({ range: '30d' })` that ignored the `?range=` the filter
 * bar had just written, so a reload silently reverted to 30 days.
 *
 * The range is resolved to explicit `startDate`/`endDate` days here, in the
 * operator's time zone, so the API never has to guess what "yesterday" means.
 */
export function useAdminAnalyticsFilter(): AdminAnalyticsFilterState {
  const [searchParams, setSearchParams] = useSearchParams();
  const [range, setRange] = useDateRangeParam(searchParams, setSearchParams, {
    storageKey: 'admin-analytics:range',
  });

  const rawPlatform = searchParams.get('platform');
  const platform: PlatformFilter =
    rawPlatform === 'web' || rawPlatform === 'desktop' ? rawPlatform : 'all';

  const setPlatform = useCallback(
    (next: PlatformFilter) => {
      const params = new URLSearchParams(searchParams);
      if (next === 'all') params.delete('platform');
      else params.set('platform', next);
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const reset = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    params.delete('platform');
    setSearchParams(params, { replace: true });
    setRange(DEFAULT_DATE_RANGE);
  }, [searchParams, setSearchParams, setRange]);

  const filter = useMemo<AdminAnalyticsFilter>(() => {
    const { from, to } = toDateRangeQuery(range);
    return {
      range: 'custom',
      startDate: from,
      endDate: to,
      ...(platform === 'all' ? {} : { platform }),
    };
  }, [range, platform]);

  return {
    filter,
    range,
    setRange,
    platform,
    setPlatform,
    reset,
    isFiltered: !isSameDateRange(range, DEFAULT_DATE_RANGE) || platform !== 'all',
  };
}
