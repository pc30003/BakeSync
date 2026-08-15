export type UserRole = "HEAD_BAKER" | "FLOOR_STAFF" | "PURCHASING_MANAGER";

export interface User {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: UserRole;
  bakeryId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: UserRole;
  bakeryId: string;
}

export interface Bakery {
  id: string;
  name: string;
  timezone: string;
  openingTime: string;   // "HH:mm" e.g. "05:00"
  closingTime: string;   // "HH:mm" e.g. "20:00"
  currency: string;      // ISO 4217 e.g. "GBP"
  createdAt: Date;
  updatedAt: Date;
}
