/**
 * Site-wide aggregates for the admin statistics page.
 *
 * Its own module rather than part of `adminPosts.ts`: nothing here is a post,
 * and the two are read by different pages.
 */

import { apiRequest } from "./api";
import type { PostStatus } from "./adminPosts";

/** One row of the "most read" table. A trimmed post, not a whole one -- the
 *  table shows four fields and the endpoint sends four. */
export interface MostReadPost {
  slug: string;
  title: string;
  status: PostStatus;
  view_count: number;
}

/** One bar of the publishing-cadence chart. `month` is "YYYY-MM". */
export interface MonthCount {
  month: string;
  count: number;
}

/** Mirrors `myapp.serializers.PostStatsSerializer`. */
export interface PostStats {
  total: number;
  published: number;
  drafts: number;
  total_views: number;
  /** Per *published* post: a draft has no public page to be read on, so
   *  counting drafts in the denominator would drag it down for a reason that
   *  has nothing to do with how well anything is read. */
  average_views: number;
  most_read: MostReadPost[];
  /** Ascending, and **only months that have a post** -- the gaps are the
   *  client's to fill, since which range to show is a question about the
   *  chart. See `fillMonths`. */
  published_by_month: MonthCount[];
}

export function fetchPostStats(signal?: AbortSignal): Promise<PostStats> {
  return apiRequest<PostStats>("/posts/stats/", { signal });
}

/**
 * Insert the empty months the API leaves out, so the chart has a real time
 * axis rather than a list of the months that happened to have posts.
 *
 * Without this, a gap year reads as a busy one: three bars for 2024, 2025 and
 * 2026 sit side by side looking like three consecutive months. Returns at most
 * `limit` months ending at the most recent one with a post.
 */
export function fillMonths(months: MonthCount[], limit = 12): MonthCount[] {
  if (months.length === 0) return [];

  const counts = new Map(months.map((row) => [row.month, row.count]));
  const [firstYear, firstMonth] = split(months[0].month);
  const [lastYear, lastMonth] = split(months[months.length - 1].month);

  const span = (lastYear - firstYear) * 12 + (lastMonth - firstMonth) + 1;
  // Count back from the newest rather than forward from the oldest: a long
  // history should lose its distant past, not its current month.
  const start = Math.max(0, span - limit);

  const filled: MonthCount[] = [];
  for (let step = start; step < span; step += 1) {
    const absolute = firstYear * 12 + (firstMonth - 1) + step;
    const key = `${Math.floor(absolute / 12)}-${String((absolute % 12) + 1).padStart(2, "0")}`;
    filled.push({ month: key, count: counts.get(key) ?? 0 });
  }
  return filled;
}

function split(month: string): [number, number] {
  const [year, index] = month.split("-");
  return [Number(year), Number(index)];
}

/** "2026-03" -> "Mar 2026", in the viewer's locale. Parsed as UTC and read back
 *  in UTC, so a browser behind Greenwich cannot show the month before. */
export function monthLabel(month: string): string {
  const [year, index] = split(month);
  return new Date(Date.UTC(year, index - 1, 1)).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
