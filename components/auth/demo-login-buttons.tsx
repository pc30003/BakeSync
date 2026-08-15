"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const DEMO_ROLES = [
  {
    email:       "head@artisanloaf.com",
    label:       "Head Baker",
    description: "Schedules · Recipes · Analytics",
    icon:        "👨‍🍳",
    color:       "bg-amber-50 border-amber-300 hover:bg-amber-100 text-amber-900",
    badge:       "bg-amber-500",
  },
  {
    email:       "floor@artisanloaf.com",
    label:       "Kitchen Staff",
    description: "Shift checklist · Wastage log",
    icon:        "🧑‍🍽️",
    color:       "bg-green-50 border-green-300 hover:bg-green-100 text-green-900",
    badge:       "bg-green-500",
  },
  {
    email:       "purchasing@artisanloaf.com",
    label:       "Purchasing Manager",
    description: "Procurement · Suppliers · Stock",
    icon:        "📦",
    color:       "bg-blue-50 border-blue-300 hover:bg-blue-100 text-blue-900",
    badge:       "bg-blue-500",
  },
] as const;

export function DemoLoginButtons() {
  const router   = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  async function handleDemoLogin(email: string) {
    setLoading(email);
    setError(null);
    try {
      const result = await signIn("credentials", {
        email,
        password: "demo",   // seed users have no password check — any value works
        redirect: false,
      });
      if (result?.error) {
        setError("Demo login failed. Make sure the database is seeded.");
      } else {
        router.push("/");
        router.refresh();
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <div className="flex-1 h-px bg-border" />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground px-2">
          Demo access
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {error && (
        <p className="text-xs text-destructive text-center">{error}</p>
      )}

      <div className="grid grid-cols-1 gap-2">
        {DEMO_ROLES.map((role) => {
          const isLoading = loading === role.email;
          return (
            <button
              key={role.email}
              onClick={() => handleDemoLogin(role.email)}
              disabled={loading !== null}
              className={cn(
                "flex items-center gap-3 w-full px-4 py-3 rounded-xl border-2 transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                role.color
              )}
              aria-label={`Sign in as ${role.label} demo account`}
            >
              <span className="text-2xl shrink-0" role="img" aria-hidden="true">
                {role.icon}
              </span>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-semibold leading-tight">{role.label}</p>
                <p className="text-[11px] opacity-70 leading-tight mt-0.5">
                  {role.description}
                </p>
              </div>
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0 opacity-60" />
              ) : (
                <span className="text-xs font-medium opacity-60 shrink-0">Demo →</span>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground text-center pt-1">
        Demo accounts — no password required
      </p>
    </div>
  );
}
