import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { DemoLoginButtons } from "@/components/auth/demo-login-buttons";
import { BakeSyncLogo } from "@/components/ui/bakesync-logo";

export const metadata: Metadata = { title: "Sign In" };

const IS_DEMO = process.env.NEXT_PUBLIC_APP_MODE === "demo";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#FFFBEB] dark:bg-background p-4">
      <div className="w-full max-w-md space-y-6">

        {/* Logo */}
        <div className="text-center flex flex-col items-center gap-2">
          <BakeSyncLogo variant="full" size="xl" className="mx-auto" />
          <p className="text-muted-foreground text-sm">
            {IS_DEMO
              ? "Autonomous AI for commercial kitchens · Competition Demo"
              : "Autonomous AI for commercial kitchens"}
          </p>
        </div>

        {/* Demo mode: one-click role cards only */}
        {IS_DEMO && (
          <div className="bg-card rounded-2xl border border-amber-200 p-5 shadow-sm">
            <DemoLoginButtons />
          </div>
        )}

        {/* Production mode: credential form + sign up link */}
        {!IS_DEMO && (
          <>
            <LoginForm />
            <p className="text-center text-xs text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-primary font-medium hover:underline">
                Create your bakery
              </Link>
            </p>
          </>
        )}

        {/* Demo mode: small print */}
        {IS_DEMO && (
          <p className="text-center text-[10px] text-muted-foreground">
            This is a competition demo — data resets periodically
          </p>
        )}
      </div>
    </main>
  );
}
