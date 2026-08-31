/**
 * lib/shifts.ts
 *
 * Single source of truth for production shift windows.
 * Used by the schedule page, floor staff page, and shift banner so the
 * definition of "which shift is active right now" never drifts.
 */

export type ShiftType = "MORNING" | "AFTERNOON" | "EVENING" | "OVERNIGHT";

export interface ShiftWindow {
  type:      ShiftType;
  label:     string;
  startHour: number; // 0-23
  endHour:   number; // 0-23 (exclusive)
  startTime: string; // "HH:mm" for display
  endTime:   string;
  icon:      string; // emoji for quick visual
}

// Ordered by start time. OVERNIGHT wraps past midnight (23:00 → 04:00).
export const SHIFT_WINDOWS: ShiftWindow[] = [
  { type: "MORNING",   label: "Morning Shift",   startHour: 4,  endHour: 12, startTime: "04:00", endTime: "12:00", icon: "🌅" },
  { type: "AFTERNOON", label: "Afternoon Shift", startHour: 12, endHour: 18, startTime: "12:00", endTime: "18:00", icon: "☀️" },
  { type: "EVENING",   label: "Evening Shift",   startHour: 18, endHour: 23, startTime: "18:00", endTime: "23:00", icon: "🌆" },
  { type: "OVERNIGHT", label: "Overnight Shift", startHour: 23, endHour: 4,  startTime: "23:00", endTime: "04:00", icon: "🌙" },
];

export const ALL_SHIFT_TYPES: ShiftType[] = ["MORNING", "AFTERNOON", "EVENING", "OVERNIGHT"];

/**
 * Returns the current hour (0-23) in a given IANA timezone.
 * This matters on the server: Vercel runs in UTC, so `date.getHours()` would
 * return the UTC hour, not the bakery's local hour — which would put the app
 * on the wrong shift. When no timezone is given, falls back to the runtime's
 * local hour (fine on the client, where it IS the user's local time).
 */
export function getHourInTimezone(now: Date, timezone?: string): number {
  if (!timezone) return now.getHours();
  try {
    const hourStr = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour:     "2-digit",
      hour12:   false,
    }).format(now);
    const hour = parseInt(hourStr, 10);
    // Intl can return "24" for midnight in some environments — normalise to 0.
    return Number.isFinite(hour) ? hour % 24 : now.getHours();
  } catch {
    // Invalid timezone string — fall back to runtime local hour.
    return now.getHours();
  }
}

/**
 * Given a Date (and optionally the bakery's timezone), returns the shift window
 * that is currently active. Handles the overnight window that wraps past midnight.
 * Pass the bakery timezone on the server so UTC hosting doesn't skew the shift.
 */
export function getCurrentShift(now: Date = new Date(), timezone?: string): ShiftWindow {
  const hour = getHourInTimezone(now, timezone);

  for (const shift of SHIFT_WINDOWS) {
    if (shift.type === "OVERNIGHT") {
      // Wraps midnight: active if hour >= 23 OR hour < 4
      if (hour >= shift.startHour || hour < shift.endHour) return shift;
    } else {
      if (hour >= shift.startHour && hour < shift.endHour) return shift;
    }
  }

  // Fallback (shouldn't hit) — return overnight
  return SHIFT_WINDOWS[3];
}

/**
 * Returns the next shift that will start after `now`, and how many minutes
 * until it begins. Useful for a "next shift starts in X" countdown.
 */
export function getNextShift(now: Date = new Date(), timezone?: string): { shift: ShiftWindow; minutesUntil: number } {
  const current = getCurrentShift(now, timezone);
  const currentIdx = SHIFT_WINDOWS.findIndex((s) => s.type === current.type);
  const nextShift = SHIFT_WINDOWS[(currentIdx + 1) % SHIFT_WINDOWS.length];

  // Minutes until the next shift's start hour (in the bakery's timezone)
  const hour = getHourInTimezone(now, timezone);
  const nowMinutes = hour * 60 + now.getMinutes();
  let startMinutes = nextShift.startHour * 60;
  if (startMinutes <= nowMinutes) startMinutes += 24 * 60; // next day
  const minutesUntil = startMinutes - nowMinutes;

  return { shift: nextShift, minutesUntil };
}

export function getShiftLabel(type: string): string {
  return SHIFT_WINDOWS.find((s) => s.type === type)?.label ?? type;
}

export function getShiftIcon(type: string): string {
  return SHIFT_WINDOWS.find((s) => s.type === type)?.icon ?? "📋";
}
