"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertCircle } from "lucide-react";

interface BakerySettings {
  id:          string;
  name:        string;
  timezone:    string;
  currency:    string;
  openingTime: string;
  closingTime: string;
  ovenCount:   number;
  plan:        string;
  subscriptionStatus: string | null;
}

interface SettingsFormProps {
  bakery: BakerySettings;
}

const TIMEZONES = [
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Europe/Madrid",
  "Europe/Rome",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Vancouver",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Pacific/Auckland",
];

const CURRENCIES = [
  { code: "GBP", label: "GBP — British Pound (£)" },
  { code: "EUR", label: "EUR — Euro (€)" },
  { code: "USD", label: "USD — US Dollar ($)" },
  { code: "AUD", label: "AUD — Australian Dollar (A$)" },
  { code: "CAD", label: "CAD — Canadian Dollar (C$)" },
  { code: "NZD", label: "NZD — New Zealand Dollar (NZ$)" },
  { code: "SGD", label: "SGD — Singapore Dollar (S$)" },
  { code: "AED", label: "AED — UAE Dirham (د.إ)" },
  { code: "JPY", label: "JPY — Japanese Yen (¥)" },
];

export function SettingsForm({ bakery }: SettingsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const [form, setForm] = useState({
    name:        bakery.name,
    timezone:    bakery.timezone,
    currency:    bakery.currency,
    openingTime: bakery.openingTime,
    closingTime: bakery.closingTime,
    ovenCount:   bakery.ovenCount,
  });

  function set(field: keyof typeof form, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (status !== "idle") setStatus("idle");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("idle");

    startTransition(async () => {
      try {
        const res = await fetch("/api/settings", {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ ...form, ovenCount: Number(form.ovenCount) }),
        });

        const json = await res.json();

        if (res.ok) {
          setStatus("success");
          router.refresh();
        } else {
          setStatus("error");
          setErrorMsg(json.error ?? "Something went wrong. Please try again.");
        }
      } catch {
        setStatus("error");
        setErrorMsg("Network error — please check your connection.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* ── Bakery Profile ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Bakery Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          <Field label="Bakery Name" htmlFor="name">
            <input
              id="name"
              type="text"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              required
              maxLength={100}
              className={inputCls}
              placeholder="The Artisan Loaf"
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Timezone" htmlFor="timezone">
              <select
                id="timezone"
                value={form.timezone}
                onChange={(e) => set("timezone", e.target.value)}
                className={inputCls}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>
                ))}
              </select>
            </Field>

            <Field label="Currency" htmlFor="currency">
              <select
                id="currency"
                value={form.currency}
                onChange={(e) => set("currency", e.target.value)}
                className={inputCls}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            </Field>
          </div>

        </CardContent>
      </Card>

      {/* ── Operating Hours ────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Operating Hours</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Opening Time" htmlFor="openingTime" hint="When your bakery opens each day">
              <input
                id="openingTime"
                type="time"
                value={form.openingTime}
                onChange={(e) => set("openingTime", e.target.value)}
                className={inputCls}
              />
            </Field>

            <Field label="Closing Time" htmlFor="closingTime" hint="When your bakery closes each day">
              <input
                id="closingTime"
                type="time"
                value={form.closingTime}
                onChange={(e) => set("closingTime", e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

        </CardContent>
      </Card>

      {/* ── Production Capacity ────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Production Capacity</CardTitle>
        </CardHeader>
        <CardContent>

          <Field label="Number of Ovens" htmlFor="ovenCount" hint="Used by the AI agent when scheduling batches">
            <input
              id="ovenCount"
              type="number"
              min={1}
              max={50}
              value={form.ovenCount}
              onChange={(e) => set("ovenCount", parseInt(e.target.value, 10) || 1)}
              className={cn(inputCls, "w-28")}
            />
          </Field>

        </CardContent>
      </Card>

      {/* ── Plan (read-only) ───────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary uppercase tracking-wide">
              {bakery.plan}
            </span>
            {bakery.subscriptionStatus && (
              <span className="text-xs text-muted-foreground capitalize">
                {bakery.subscriptionStatus.replace(/_/g, " ")}
              </span>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Plan changes are managed via the Billing page.
          </p>
        </CardContent>
      </Card>

      {/* ── Status feedback + Save ─────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="text-sm">
          {status === "success" && (
            <span className="flex items-center gap-1.5 text-green-600 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              Settings saved successfully
            </span>
          )}
          {status === "error" && (
            <span className="flex items-center gap-1.5 text-destructive font-medium">
              <AlertCircle className="w-4 h-4" />
              {errorMsg}
            </span>
          )}
        </div>
        <Button
          type="submit"
          variant="primary"
          size="md"
          loading={isPending}
          className="min-w-[120px]"
        >
          Save Changes
        </Button>
      </div>

    </form>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm " +
  "text-foreground placeholder:text-muted-foreground " +
  "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary " +
  "disabled:opacity-50 transition-colors";

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}
