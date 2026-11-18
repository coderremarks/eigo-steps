/**
 * Calendar-day helpers. Review schedules are stored as local calendar dates ("2026-11-18") rather
 * than timestamps, so "due today" means the learner's today, regardless of time zone or DST.
 */

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDateString(value: string): boolean {
  return DATE_PATTERN.test(value);
}

export function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parts(value: string): [number, number, number] {
  const match = DATE_PATTERN.exec(value);
  if (!match) throw new Error(`Invalid date string: ${value}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function addDays(value: string, days: number): string {
  const [year, month, day] = parts(value);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = parts(from);
  const [y2, m2, d2] = parts(to);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/** Consecutive active days ending today or yesterday. */
export function currentStreak(activeDays: readonly string[], today: string): number {
  const days = new Set(activeDays);
  let cursor = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function formatShortDate(value: string, locale = 'en-US'): string {
  const [year, month, day] = parts(value);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
