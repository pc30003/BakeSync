"use client";

import { useState, useEffect, useCallback } from "react";
import { X, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── Event name used to (re)launch the tour from anywhere (e.g. the TopBar) ──
export const DEMO_TOUR_EVENT = "bakesync:open-tour";
const SEEN_KEY = "bakesync-tour-seen";

/** Fire this from any client component to open the tour. */
export function openDemoTour() {
  window.dispatchEvent(new Event(DEMO_TOUR_EVENT));
}

interface TourStep {
  title: string;
  description: string;
  icon: string;
  accent: string;            // tailwind gradient classes for the preview panel
  preview: React.ReactNode;  // a small visual mock of the feature
}

// ── Small reusable preview pieces ───────────────────────────────────────────
function MiniBar({ w, color = "bg-primary" }: { w: string; color?: string }) {
  return <div className={cn("h-2 rounded-full", color)} style={{ width: w }} />;
}
function Chip({ children, tone = "primary" }: { children: React.ReactNode; tone?: "primary" | "green" | "red" | "amber" }) {
  const tones: Record<string, string> = {
    primary: "bg-primary/15 text-primary",
    green:   "bg-green-500/15 text-green-600 dark:text-green-400",
    red:     "bg-red-500/15 text-red-600 dark:text-red-400",
    amber:   "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  };
  return <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", tones[tone])}>{children}</span>;
}
function MockCard({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg bg-card/80 backdrop-blur border border-border/60 p-2.5 shadow-sm space-y-1.5">{children}</div>;
}

// ── Role-specific tours ─────────────────────────────────────────────────────

const HEAD_BAKER_STEPS: TourStep[] = [
  {
    title: "Welcome to BakeSync",
    description: "Your autonomous production brain. As Head Baker you plan, approve, and analyse — the AI does the heavy thinking. Here's a 60-second tour.",
    icon: "👋", accent: "from-primary/20 to-amber-200/30",
    preview: (
      <div className="flex items-center gap-2 justify-center">
        <Sparkles className="w-8 h-8 text-primary" />
        <div className="space-y-1">
          <MiniBar w="90px" /><MiniBar w="60px" color="bg-primary/40" />
        </div>
      </div>
    ),
  },
  {
    title: "AI generates your schedule",
    description: "Click 'Generate schedule' — GPT-4o reads your orders, stock, and oven capacity and plans the whole day in seconds, with its reasoning shown in plain English.",
    icon: "🤖", accent: "from-purple-300/30 to-primary/20",
    preview: (
      <MockCard>
        <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" /><span className="text-[10px] font-medium">AI planning…</span></div>
        <MiniBar w="100%" color="bg-purple-400" /><MiniBar w="75%" color="bg-purple-300" />
        <div className="flex gap-1 pt-0.5"><Chip tone="primary">2 batches</Chip><Chip tone="green">0 shortfalls</Chip></div>
      </MockCard>
    ),
  },
  {
    title: "You stay in control",
    description: "Nothing goes live until you approve it. Review the AI's plan, then approve — only then can floor staff see their checklists. The AI recommends; you decide.",
    icon: "✅", accent: "from-green-300/30 to-primary/20",
    preview: (
      <MockCard>
        <div className="flex items-center justify-between"><span className="text-[10px] font-medium">Morning Schedule</span><Chip tone="amber">Pending</Chip></div>
        <div className="h-7 rounded-md bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center">✓ Approve schedule</div>
      </MockCard>
    ),
  },
  {
    title: "Live inventory & alerts",
    description: "Stock updates in real time as production happens. Ingredients move through OK → Low → Critical, and the system raises alerts and procurement recs automatically.",
    icon: "📦", accent: "from-amber-300/30 to-red-200/30",
    preview: (
      <MockCard>
        <div className="flex items-center justify-between text-[10px]"><span>Dark Chocolate</span><Chip tone="green">OK</Chip></div>
        <MiniBar w="80%" color="bg-green-500" />
        <div className="flex items-center justify-between text-[10px]"><span>Gelatin Powder</span><Chip tone="red">Critical</Chip></div>
        <MiniBar w="18%" color="bg-red-500" />
      </MockCard>
    ),
  },
  {
    title: "Smart procurement",
    description: "The AI flags what to reorder BEFORE you run out — based on upcoming demand, not just current stock. Approve an order in one click and stock restocks instantly.",
    icon: "🛒", accent: "from-primary/20 to-blue-200/30",
    preview: (
      <MockCard>
        <div className="flex items-center justify-between"><span className="text-[10px] font-medium">Fresh Lime Juice</span><Chip tone="red">Priority: Urgent</Chip></div>
        <p className="text-[9px] text-muted-foreground leading-tight">Upcoming panna cotta orders will drain stock.</p>
        <div className="h-6 rounded-md bg-primary/15 text-primary text-[10px] font-semibold flex items-center justify-center">Order now →</div>
      </MockCard>
    ),
  },
  {
    title: "Analytics that reduce waste",
    description: "See batch completion, waste trends, and stock health at a glance — plus AI wastage analysis with cost-saving suggestions. The system learns and helps you improve.",
    icon: "📊", accent: "from-blue-300/30 to-green-200/30",
    preview: (
      <MockCard>
        <div className="flex items-end gap-1 h-12">
          <div className="flex-1 bg-primary/70 rounded-t" style={{ height: "40%" }} />
          <div className="flex-1 bg-primary/70 rounded-t" style={{ height: "70%" }} />
          <div className="flex-1 bg-primary/70 rounded-t" style={{ height: "55%" }} />
          <div className="flex-1 bg-primary rounded-t" style={{ height: "90%" }} />
        </div>
        <span className="text-[9px] text-muted-foreground">Waste trend (30d)</span>
      </MockCard>
    ),
  },
];

const FLOOR_STAFF_STEPS: TourStep[] = [
  {
    title: "Welcome, Kitchen Staff",
    description: "This is your shift companion. Follow the production checklist step by step, and log any wastage. Here's how it works.",
    icon: "👋", accent: "from-primary/20 to-amber-200/30",
    preview: (
      <div className="flex items-center gap-2 justify-center">
        <span className="text-3xl">🧑‍🍳</span>
        <div className="space-y-1"><MiniBar w="90px" /><MiniBar w="60px" color="bg-primary/40" /></div>
      </div>
    ),
  },
  {
    title: "Your shift checklist",
    description: "Once the Head Baker approves the day's schedule, your step-by-step checklist appears here — one clear task at a time.",
    icon: "📋", accent: "from-primary/20 to-blue-200/30",
    preview: (
      <MockCard>
        <div className="flex items-center gap-2 text-[10px]"><span className="w-4 h-4 rounded bg-green-500 text-white flex items-center justify-center text-[9px]">✓</span><span className="line-through text-muted-foreground">Melt chocolate & butter</span></div>
        <div className="flex items-center gap-2 text-[10px]"><span className="w-4 h-4 rounded border-2 border-primary" /><span>Whisk eggs & sugar</span></div>
        <div className="flex items-center gap-2 text-[10px] opacity-40"><span className="w-4 h-4 rounded border border-muted-foreground/40" /><span>Fold in flour</span></div>
      </MockCard>
    ),
  },
  {
    title: "Tick as you go — stock updates live",
    description: "Complete steps in order. As you tick each one, the exact ingredients are deducted from stock automatically. The next step unlocks when you're ready.",
    icon: "✓", accent: "from-green-300/30 to-primary/20",
    preview: (
      <MockCard>
        <div className="flex items-center justify-between text-[10px]"><span>Step complete</span><Chip tone="green">3/6 done</Chip></div>
        <MiniBar w="50%" color="bg-green-500" />
        <div className="flex gap-1"><Chip tone="amber">📦 Flour −390g</Chip></div>
      </MockCard>
    ),
  },
  {
    title: "Log wastage in seconds",
    description: "Spillage, spoilage, or a failed batch? Log it here. It deducts from stock and flags the Head Baker — keeping the numbers honest.",
    icon: "🗑️", accent: "from-red-200/30 to-amber-200/30",
    preview: (
      <MockCard>
        <span className="text-[10px] font-medium">Log wastage</span>
        <div className="h-5 rounded bg-muted/60 text-[9px] flex items-center px-1.5 text-muted-foreground">Cake Flour · 250g · Spillage</div>
        <div className="h-5 rounded bg-primary/15 text-primary text-[10px] font-semibold flex items-center justify-center">Submit</div>
      </MockCard>
    ),
  },
];

const PURCHASING_STEPS: TourStep[] = [
  {
    title: "Welcome, Purchasing Manager",
    description: "You keep the bakery stocked. The system tells you what to order before you run short — here's the quick tour.",
    icon: "👋", accent: "from-primary/20 to-amber-200/30",
    preview: (
      <div className="flex items-center gap-2 justify-center">
        <span className="text-3xl">📦</span>
        <div className="space-y-1"><MiniBar w="90px" /><MiniBar w="60px" color="bg-primary/40" /></div>
      </div>
    ),
  },
  {
    title: "AI procurement intelligence",
    description: "The AI analyses upcoming demand and supplier lead times to recommend what to order — and flags urgent items before they run out, not after.",
    icon: "🤖", accent: "from-purple-300/30 to-primary/20",
    preview: (
      <MockCard>
        <div className="flex items-center justify-between"><span className="text-[10px] font-medium">Dark Chocolate</span><Chip tone="red">Priority: Urgent</Chip></div>
        <p className="text-[9px] text-muted-foreground leading-tight">High brownie demand · order 20kg</p>
        <div className="flex gap-1"><Chip tone="primary">Arrives ~3 days</Chip></div>
      </MockCard>
    ),
  },
  {
    title: "One-click ordering",
    description: "Approve a recommendation and the ingredient restocks instantly — the alert clears and the whole team sees the update in real time.",
    icon: "✅", accent: "from-green-300/30 to-primary/20",
    preview: (
      <MockCard>
        <div className="flex items-center justify-between text-[10px]"><span>Mango & Apricot Puree</span><Chip tone="green">Ordered ✓</Chip></div>
        <MiniBar w="95%" color="bg-green-500" />
        <span className="text-[9px] text-muted-foreground">Restocked · just now</span>
      </MockCard>
    ),
  },
  {
    title: "Suppliers & stock",
    description: "Manage your supplier directory with lead times and contacts, and monitor live stock levels and incoming orders — all in one place.",
    icon: "🚚", accent: "from-blue-300/30 to-primary/20",
    preview: (
      <MockCard>
        <div className="flex items-center justify-between text-[10px]"><span>BakeStock Wholesale</span><Chip tone="primary">2d lead</Chip></div>
        <div className="flex items-center justify-between text-[10px]"><span>Callebaut UK</span><Chip tone="primary">3d lead</Chip></div>
      </MockCard>
    ),
  },
];

const IS_DEMO = process.env.NEXT_PUBLIC_APP_MODE === "demo";

interface DemoTourProps {
  role: string;
}

export function DemoTour({ role }: DemoTourProps) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  const steps = role === "HEAD_BAKER" ? HEAD_BAKER_STEPS
              : role === "FLOOR_STAFF" ? FLOOR_STAFF_STEPS
              : PURCHASING_STEPS;

  const open = useCallback(() => { setStep(0); setVisible(true); }, []);

  const close = useCallback(() => {
    setVisible(false);
    try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* ignore */ }
  }, []);

  // Auto-show once (first visit), then allow manual relaunch via event.
  useEffect(() => {
    if (!IS_DEMO) return;
    let seen = false;
    try { seen = localStorage.getItem(SEEN_KEY) === "1"; } catch { /* ignore */ }
    if (!seen) {
      const t = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  // Listen for relaunch requests (the TopBar "Tour" button).
  useEffect(() => {
    if (!IS_DEMO) return;
    window.addEventListener(DEMO_TOUR_EVENT, open);
    return () => window.removeEventListener(DEMO_TOUR_EVENT, open);
  }, [open]);

  if (!IS_DEMO || !visible) return null;

  const current = steps[step];
  const isFirst = step === 0;
  const isLast  = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Feature tour">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={close} />

      {/* Tour card */}
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-fade-in">
        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <div className="h-full bg-primary transition-all duration-300" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
        </div>

        {/* Close (skip anytime) */}
        <button
          onClick={close}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-lg bg-card/70 hover:bg-muted transition-colors"
          aria-label="Skip tour"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>

        {/* Visual preview panel */}
        <div className={cn("relative px-6 pt-8 pb-5 bg-gradient-to-br", current.accent)}>
          <div className="max-w-[240px] mx-auto">{current.preview}</div>
        </div>

        {/* Content */}
        <div className="px-6 pt-4 pb-3 text-center">
          <span className="text-3xl mb-2 block" role="img" aria-hidden="true">{current.icon}</span>
          <h2 className="text-lg font-bold text-foreground mb-1.5">{current.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{current.description}</p>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 pb-2">
          {steps.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === step ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30"
              )}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 pb-5 pt-1">
          <button onClick={close} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Skip tour
          </button>

          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button size="sm" variant="ghost" onClick={() => setStep(step - 1)}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            )}
            {isLast ? (
              <Button size="sm" variant="primary" onClick={close}>
                Get Started
              </Button>
            ) : (
              <Button size="sm" variant="primary" onClick={() => setStep(step + 1)}>
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
