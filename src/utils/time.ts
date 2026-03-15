import { DateTime } from 'luxon';

/**
 * Returns the configured IANA timezone (defaults to America/Toronto).
 */
export function getTimezone(): string {
  return process.env.TIMEZONE || 'America/Toronto';
}

/**
 * Parse a date + time string pair from the API into a Luxon DateTime in UTC.
 * The API returns dates like "2025-03-14" and times like "15:00:00".
 */
export function parseSessionDateTime(date: string, time: string): DateTime {
  // The API times are in UTC
  return DateTime.fromISO(`${date}T${time}`, { zone: 'utc' });
}

/**
 * Format a UTC DateTime into a human-readable string in the configured timezone.
 * Example output: "Fri, Mar 14 · 11:00 AM ET"
 */
export function formatSessionTime(dt: DateTime): string {
  const tz = getTimezone();
  const local = dt.setZone(tz);
  // Show short timezone abbreviation (e.g. EST/EDT)
  return local.toFormat("ccc, LLL dd · hh:mm a 'ET'");
}

/**
 * Format a date-only string into a readable date in the configured timezone.
 */
export function formatDate(dt: DateTime): string {
  const tz = getTimezone();
  return dt.setZone(tz).toFormat('ccc, LLL dd yyyy');
}

/**
 * Check if a session datetime is in the past relative to now.
 */
export function isInPast(dt: DateTime): boolean {
  return dt < DateTime.utc();
}

/**
 * Get current time as a UTC DateTime.
 */
export function nowUtc(): DateTime {
  return DateTime.utc();
}

/**
 * Returns the number of hours until the given DateTime from now.
 * Negative if in the past.
 */
export function hoursUntil(dt: DateTime): number {
  return dt.diff(DateTime.utc(), 'hours').hours;
}
