/**
 * Converts a date input to Unix seconds, the only format Chatwoot's notification snooze accepts
 * (DateRangeHelper#parse_date_time runs DateTime.strptime(value, '%s'): an ISO string is read as
 * its leading digits, e.g. "2026-..." becomes 1970-01-01T00:33:46).
 * Accepts ISO 8601 strings, Date objects, and Unix timestamps in seconds or milliseconds.
 * Throws a plain Error (wrapped with the item index by the execute catch) for anything else.
 */
export function toUnixSeconds(value: unknown, fieldName: string): number {
  if (value instanceof Date) {
    const ms = value.getTime();
    if (Number.isNaN(ms)) throw new Error(`${fieldName} is not a valid date`);
    return Math.floor(ms / 1000);
  }

  const text = String(value ?? '').trim();
  if (!text) throw new Error(`${fieldName} is required`);

  if (/^\d+(\.\d+)?$/.test(text)) {
    const numeric = Number(text);
    // 13+ digit values are milliseconds (any seconds value below 1e12 is before the year 33658)
    return Math.floor(numeric >= 1e12 ? numeric / 1000 : numeric);
  }

  const ms = Date.parse(text);
  if (Number.isNaN(ms)) {
    throw new Error(
      `${fieldName} must be a date/time (ISO 8601) or a Unix timestamp, got "${text}"`,
    );
  }
  return Math.floor(ms / 1000);
}
