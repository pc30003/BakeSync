import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { SignUpForm } from "@/components/auth/signup-form";
import { BakeSyncLogo } from "@/components/ui/bakesync-logo";
import Link from "next/link";

export const metadata: Metadata = { title: "Create your bakery" };

// Hard-redirect in demo mode — no sign-up available
export default function SignUpPage() {
  if (process.env.NEXT_PUBLIC_APP_MODE === "demo") {
    redirect("/login");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#FFFBEB] p-4">
      <div className="w-full max-w-md space-y-6">

        <div className="text-center flex flex-col items-center gap-2">
          <BakeSyncLogo variant="full" size="lg" className="mx-auto" />
          <p className="text-muted-foreground text-sm">
            Set up your bakery in 2 minutes
          </p>
        </div>

        <SignUpForm />

        <p className="text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
