// Display helpers. Times are always shown in the airport's own time zone, like airport boards.

const MINUTE = 60_000;

function fmt(iso: string, timeZone: string | undefined, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(undefined, { ...opts, ...(timeZone && { timeZone }) }).format(
    new Date(iso),
  );
}

/** "14:05" (or "2:05 PM", following the device's locale) at the airport. */
export function timeAt(iso: string | undefined, timeZone?: string): string {
  if (!iso) return "--:--";
  return fmt(iso, timeZone, { hour: "numeric", minute: "2-digit" });
}

/** "Mon, Nov 2" at the airport. */
export function dateAt(iso: string | undefined, timeZone?: string): string {
  if (!iso) return "";
  return fmt(iso, timeZone, { weekday: "short", month: "short", day: "numeric" });
}

/** "Mon, Nov 2" for a plain YYYY-MM-DD date. */
export function formatLocalDate(localDate: string): string {
  return fmt(`${localDate}T12:00:00Z`, "UTC", { weekday: "short", month: "short", day: "numeric" });
}

/** "2h 35m", "45m". */
export function duration(ms: number): string {
  const total = Math.max(0, Math.round(ms / MINUTE));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** "in 2h 15m", "in 1d 3h", "in 6 days" or "45m ago". */
export function relative(targetMs: number, nowMs: number): string {
  const diff = targetMs - nowMs;
  const abs = Math.abs(diff);
  if (abs < MINUTE) return "now";
  const day = 24 * 60 * MINUTE;
  let text: string;
  if (abs >= 2 * day) text = `${Math.round(abs / day)} days`;
  else if (abs >= day) {
    const h = Math.round((abs - day) / (60 * MINUTE));
    text = h ? `1d ${h}h` : "1 day";
  } else text = duration(abs);
  return diff > 0 ? `in ${text}` : `${text} ago`;
}

/** Minutes between scheduled and best-known time, rounded; positive = late. */
export function minutesLate(scheduled?: string, best?: string): number {
  if (!scheduled || !best) return 0;
  return Math.round((Date.parse(best) - Date.parse(scheduled)) / MINUTE);
}

/** Today's date as YYYY-MM-DD in the device's time zone, plus an offset in days. */
export function localDateOffset(days: number, now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
