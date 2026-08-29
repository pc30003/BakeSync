import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatGrams(grams: number): string {
  // Smart units: grams for small amounts, kg for bulk (with enough precision
  // to show small deductions).
  if (grams < 2000) {
    // Small items (salt, yeast, gelatin) — show in grams
    return `${Math.round(grams).toLocaleString("en-US")} g`;
  }
  // Bulk items — show in kg with 3 decimals so a few grams still register
  const kg = grams / 1000;
  // Trim trailing zeros: 45.000 → 45, 4.997 → 4.997
  const formatted = parseFloat(kg.toFixed(3)).toLocaleString("en-US", { maximumFractionDigits: 3 });
  return `${formatted} kg`;
}

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(date));
}

export function formatTime(date: Date | string): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(date));
}

export function formatDateTime(date: Date | string): string {
  return `${formatDate(date)} ${formatTime(date)}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function getAlertColor(level: string) {
  switch (level) {
    case "OUT_OF_STOCK": return "text-red-700 bg-red-50 border-red-200";
    case "CRITICAL":     return "text-orange-700 bg-orange-50 border-orange-200";
    case "LOW":          return "text-yellow-700 bg-yellow-50 border-yellow-200";
    default:             return "text-green-700 bg-green-50 border-green-200";
  }
}

export function getSeverityColor(severity: string) {
  switch (severity) {
    case "CRITICAL": return "text-red-700 bg-red-50 border-red-200";
    case "WARNING":  return "text-yellow-700 bg-yellow-50 border-yellow-200";
    default:         return "text-blue-700 bg-blue-50 border-blue-200";
  }
}

export function getBatchStatusColor(status: string) {
  switch (status) {
    case "COMPLETED":   return "text-green-700 bg-green-50";
    case "IN_PROGRESS": return "text-blue-700 bg-blue-50";
    case "BLOCKED":     return "text-red-700 bg-red-50";
    case "CANCELLED":   return "text-gray-500 bg-gray-50";
    default:            return "text-amber-700 bg-amber-50";
  }
}
