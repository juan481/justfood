// Argentina has not observed DST since 2009 — America/Argentina/Buenos_Aires
// is a fixed UTC-3 year-round, so a constant offset is reliable (no need for
// a timezone database lookup). This matters because "today" boundary
// calculations (KDS board, Arqueo, Estadísticas) must not depend on the
// server OS's local timezone: the dev machine happens to already be set to
// Argentina time, but the Hetzner VPS defaults to UTC, and `new Date();
// setHours(0,0,0,0)` silently uses whatever timezone the process runs in.
const AR_OFFSET_HOURS = -3;

/** Start of "today" in Argentina time, returned as a UTC Date instant. */
export function startOfTodayAR(): Date {
  const now = new Date();
  const arNow = new Date(now.getTime() + AR_OFFSET_HOURS * 3600_000);
  const startOfDayAR = Date.UTC(arNow.getUTCFullYear(), arNow.getUTCMonth(), arNow.getUTCDate(), 0, 0, 0, 0);
  return new Date(startOfDayAR - AR_OFFSET_HOURS * 3600_000);
}

/** [start, end] UTC instants covering a given "YYYY-MM-DD" calendar day in Argentina time. */
export function dayRangeAR(dateStr: string): [Date, Date] {
  const [y, m, d] = dateStr.split('-').map(Number);
  const startUtcMs = Date.UTC(y, m - 1, d, 0, 0, 0, 0) - AR_OFFSET_HOURS * 3600_000;
  const start = new Date(startUtcMs);
  const end = new Date(startUtcMs + 24 * 3600_000 - 1);
  return [start, end];
}

/** "YYYY-MM-DD" for a given instant, as a calendar date in Argentina time. */
export function toDateKeyAR(date: Date): string {
  const arDate = new Date(date.getTime() + AR_OFFSET_HOURS * 3600_000);
  return arDate.toISOString().slice(0, 10);
}
