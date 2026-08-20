"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";
import { DemoBanner } from "./demo-banner";
import { ToastContainer } from "@/components/ui/toast-notification";
import { AlertPoller } from "@/components/agent/alert-poller";
import { DemoTour } from "@/components/ui/demo-tour";
import type { SessionUser } from "@/types";

const IS_DEMO = process.env.NEXT_PUBLIC_APP_MODE === "demo";

interface AppShellProps {
  user:     SessionUser;
  children: React.ReactNode;
}

export function AppShell({ user, children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Demo banner — pinned above everything in demo mode */}
      {IS_DEMO && <DemoBanner />}

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <Sidebar
          user={user}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
          <TopBar user={user} onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 p-4 md:p-6 lg:p-8 animate-fade-in">
            {children}
          </main>
        </div>
      </div>

      {/* Toast notifications */}
      <ToastContainer />
      {/* Poll for new alerts and show toasts */}
      <AlertPoller />
      {/* Demo tour guide */}
      <DemoTour role={user.role} />
    </div>
  );
}
