"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const INPUT  = "w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow";
const LABEL  = "block text-sm font-medium text-foreground mb-1.5";
const STEPS  = ["Your account", "Your bakery", "Ready"];

export function SignUpForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [isPending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Step 0
  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");

  // Step 1
  const [bakeryName,  setBakeryName]  = useState("");
  const [timezone,    setTimezone]    = useState("Europe/London");
  const [currency,    setCurrency]    = useState("GBP");
  const [ovenCount,   setOvenCount]   = useState("2");
  const [openingTime, setOpeningTime] = useState("05:00");
  const [closingTime, setClosingTime] = useState("18:00");

  function validateStep0(): string | null {
    if (!name.trim())                      return "Enter your name.";
    if (!email.includes("@"))              return "Enter a valid email address.";
    if (password.length < 8)              return "Password must be at least 8 characters.";
    if (password !== confirm)             return "Passwords do not match.";
    return null;
  }

  function validateStep1(): string | null {
    if (!bakeryName.trim()) return "Enter your bakery name.";
    return null;
  }

  function goNext() {
    const err = step === 0 ? validateStep0() : validateStep1();
    if (err) { setError(err); return; }
    setError(null);
    setStep(s => s + 1);
  }

  function submit() {
    start(async () => {
      setError(null);
      try {
        // 1. Create account
        const res = await fetch("/api/auth/register", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name, email, password,
            bakeryName, timezone, currency,
          }),
        });
        const json = await res.json();
        if (!res.ok) { setError(json.error ?? "Registration failed."); return; }

        // 2. Sign in automatically
        const login = await signIn("credentials", {
          email, password, redirect: false,
        });
        if (login?.error) { setError("Account created but sign-in failed. Please log in manually."); return; }

        // 3. Save bakery settings + mark onboarded
        await fetch("/api/onboarding", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ovenCount:   parseInt(ovenCount),
            openingTime, closingTime, complete: true,
          }),
        });

        router.push("/dashboard");
        router.refresh();
      } catch (e) {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-5">

        {/* Step indicator */}
        <div className="flex items-center gap-1">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-1 flex-1">
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors",
                i < step  ? "bg-green-500 text-white" :
                i === step ? "bg-primary text-white" :
                             "bg-muted text-muted-foreground"
              )}>
                {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className={cn(
                "text-xs hidden sm:block",
                i === step ? "text-foreground font-medium" : "text-muted-foreground"
              )}>{label}</span>
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-px bg-border mx-1" />
              )}
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div role="alert" className="px-3 py-2.5 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg">
            {error}
          </div>
        )}

        {/* ── Step 0: Account ──────────────────────────────────────────── */}
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <label className={LABEL}>Full name <span className="text-destructive">*</span></label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Sarah Chen" className={INPUT} autoFocus />
            </div>
            <div>
              <label className={LABEL}>Work email <span className="text-destructive">*</span></label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="sarah@artisanloaf.com" className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Password <span className="text-destructive">*</span></label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters" className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Confirm password <span className="text-destructive">*</span></label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                placeholder="••••••••" className={INPUT} />
            </div>
          </div>
        )}

        {/* ── Step 1: Bakery ───────────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className={LABEL}>Bakery name <span className="text-destructive">*</span></label>
              <input type="text" value={bakeryName} onChange={e => setBakeryName(e.target.value)}
                placeholder="The Artisan Loaf" className={INPUT} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Timezone</label>
                <select value={timezone} onChange={e => setTimezone(e.target.value)} className={INPUT}>
                  <option value="Europe/London">London (GMT)</option>
                  <option value="Europe/Paris">Paris (CET)</option>
                  <option value="America/New_York">New York (ET)</option>
                  <option value="America/Chicago">Chicago (CT)</option>
                  <option value="America/Los_Angeles">Los Angeles (PT)</option>
                  <option value="America/Toronto">Toronto (ET)</option>
                  <option value="Australia/Sydney">Sydney (AEDT)</option>
                  <option value="Asia/Singapore">Singapore (SGT)</option>
                  <option value="Asia/Dubai">Dubai (GST)</option>
                </select>
              </div>
              <div>
                <label className={LABEL}>Currency</label>
                <select value={currency} onChange={e => setCurrency(e.target.value)} className={INPUT}>
                  <option value="GBP">GBP £</option>
                  <option value="USD">USD $</option>
                  <option value="EUR">EUR €</option>
                  <option value="CAD">CAD $</option>
                  <option value="AUD">AUD $</option>
                  <option value="SGD">SGD $</option>
                  <option value="AED">AED د.إ</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={LABEL}>Opening time</label>
                <input type="time" value={openingTime} onChange={e => setOpeningTime(e.target.value)} className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Closing time</label>
                <input type="time" value={closingTime} onChange={e => setClosingTime(e.target.value)} className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Ovens</label>
                <input type="number" min="1" max="20" value={ovenCount}
                  onChange={e => setOvenCount(e.target.value)} className={INPUT} />
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Ready ────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="text-center py-4 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-green-50 border-2 border-green-200 mx-auto flex items-center justify-center">
              <span className="text-4xl" role="img" aria-hidden="true">🍞</span>
            </div>
            <div>
              <h2 className="font-bold text-lg text-foreground">
                You're ready, {name.split(" ")[0]}!
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                <strong>{bakeryName}</strong> is set up. The BakeSync agent will start
                monitoring your kitchen as soon as you add your first ingredients and recipes.
              </p>
            </div>
            <div className="text-left bg-muted/50 rounded-xl p-4 space-y-2 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">What happens next:</p>
              <p>1. Add your ingredients and stock levels</p>
              <p>2. Create your first recipe with baking stages</p>
              <p>3. The AI agent generates your first production schedule</p>
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-1">
          {step > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => { setStep(s => s - 1); setError(null); }}
              leftIcon={<ChevronLeft className="w-4 h-4" />}>
              Back
            </Button>
          ) : <div />}

          {step < 2 ? (
            <Button onClick={goNext} rightIcon={<ChevronRight className="w-4 h-4" />}>
              {step === 1 ? "Review" : "Continue"}
            </Button>
          ) : (
            <Button loading={isPending} onClick={submit}
              leftIcon={<Check className="w-4 h-4" />}
              className="bg-green-600 hover:bg-green-700">
              Create my bakery
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
