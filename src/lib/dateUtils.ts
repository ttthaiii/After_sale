/** Returns today's date in YYYY-MM-DD using Thai timezone (UTC+7) */
export const todayTH = (): string =>
  new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];

/** Converts any Date to YYYY-MM-DD using Thai timezone (UTC+7) */
export const toDateStrTH = (d: Date): string =>
  new Date(d.getTime() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];
