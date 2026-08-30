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
 * Given a Date, returns the shift window that is currently active.
 * Handles the overnight window that wraps past midnight.
 */
export function getCurrentShift(now: Date = new Date()): ShiftWindow {
  const hour = now.getHours();

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
export function getNextShift(now: Date = new Date()): { shift: ShiftWindow; minutesUntil: number } {
  const current = getCurrentShift(now);
  const currentIdx = SHIFT_WINDOWS.findIndex((s) => s.type === current.type);
  const nextShift = SHIFT_WINDOWS[(currentIdx + 1) % SHIFT_WINDOWS.length];

  // Minutes until the next shift's start hour
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
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
