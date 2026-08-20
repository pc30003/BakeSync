"use client";

import { useState, useEffect } from "react";
import { X, ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TourStep {
  title: string;
  description: string;
  icon: string;
}

const HEAD_BAKER_STEPS: TourStep[] = [
  { title: "Welcome to BakeSync", description: "You're logged in as Head Baker — you have full control over production, recipes, and inventory.", icon: "👋" },
  { title: "AI Schedule Generation", description: "Go to Today's Schedule and click 'Generate schedule'. The AI will analyze your orders, stock, and oven capacity to create an optimal production plan.", icon: "🤖" },
  { title: "Approve Schedules", description: "After the AI generates a schedule, review it and click 'Approve'. Floor staff can only see checklists after your approval.", icon: "✅" },
  { title: "Monitor Inventory", description: "Stock Levels shows all ingredients in real-time. When stock drops below thresholds, alerts and procurement recommendations are created automatically.", icon: "📦" },
  { title: "Procurement", description: "The Recommendations page shows what to order. Click 'Approve' to auto-restock. Try 'Analyze supply needs' for AI-powered procurement intelligence.", icon: "🛒" },
  { title: "Analytics", description: "View wastage trends, batch completion rates, and stock health. Click 'Analyze wastage' for AI insights on reducing waste.", icon: "📊" },
  { title: "Recipes", description: "Browse and edit the recipe library. Each recipe has ingredients, stages, and timing — the AI uses these when scheduling.", icon: "📖" },
  { title: "Real-Time Alerts", description: "The bell icon shows notifications. You'll get toast alerts when stock drops critical. Everything updates in real-time.", icon: "🔔" },
];

const FLOOR_STAFF_STEPS: TourStep[] = [
  { title: "Welcome to BakeSync", description: "You're logged in as Kitchen Staff. Your job is to follow the production checklist and log any wastage.", icon: "👋" },
  { title: "My Shift", description: "This is your main page. Once the Head Baker approves today's schedule, your step-by-step checklist appears here.", icon: "📋" },
  { title: "Follow the Checklist", description: "Steps must be completed in order. Tick each step as you finish it — the next step unlocks automatically.", icon: "✓" },
  { title: "Log Wastage", description: "If ingredients are wasted (spillage, spoilage, overproduction), log it here. It auto-deducts from stock and alerts the Head Baker.", icon: "🗑️" },
  { title: "Real-Time Updates", description: "When the Head Baker approves a new schedule, it appears on your page automatically. Watch for toast notifications!", icon: "🔔" },
];

const PURCHASING_STEPS: TourStep[] = [
  { title: "Welcome to BakeSync", description: "You're logged in as Purchasing Manager. You manage supplier orders and procurement approvals.", icon: "👋" },
  { title: "Procurement Recommendations", description: "The system automatically detects low stock and creates purchase recommendations. Review and approve them with one click.", icon: "🛒" },
  { title: "Approve to Restock", description: "When you approve a recommendation, it instantly restocks the ingredient and clears the alert. The whole team sees the update.", icon: "✅" },
  { title: "AI Procurement Analysis", description: "Click 'Analyze supply needs' for AI-powered insights on what to order based on upcoming demand and supplier lead times.", icon: "🤖" },
  { title: "Suppliers", description: "View and manage your supplier directory with contact details, lead times, and notes.", icon: "🚚" },
  { title: "Orders & Stock", description: "Monitor incoming orders and current stock levels. Alerts notify you when action is needed.", icon: "📦" },
];

const IS_DEMO = process.env.NEXT_PUBLIC_APP_MODE === "demo";

interface DemoTourProps {
  role: string;
}

export function DemoTour({ role }: DemoTourProps) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (IS_DEMO) {
      // Small delay so the page loads first
      const timer = setTimeout(() => setVisible(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!IS_DEMO || !visible) return null;

  const steps = role === "HEAD_BAKER" ? HEAD_BAKER_STEPS
              : role === "FLOOR_STAFF" ? FLOOR_STAFF_STEPS
              : PURCHASING_STEPS;

  const current = steps[step];
  const isFirst = step === 0;
  const isLast = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setVisible(false)} />

      {/* Tour card */}
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-fade-in">
        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>

        {/* Close button */}
        <button
          onClick={() => setVisible(false)}
          className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-muted transition-colors"
          aria-label="Skip tour"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>

        {/* Content */}
        <div className="px-6 pt-6 pb-4 text-center">
          <span className="text-4xl mb-3 block" role="img" aria-hidden="true">
            {current.icon}
          </span>
          <h2 className="text-lg font-bold text-foreground mb-2">{current.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{current.description}</p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 pb-5 pt-2">
          <span className="text-xs text-muted-foreground">
            {step + 1} of {steps.length}
          </span>

          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button size="sm" variant="ghost" onClick={() => setStep(step - 1)}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            )}
            {isLast ? (
              <Button size="sm" variant="primary" onClick={() => setVisible(false)}>
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
