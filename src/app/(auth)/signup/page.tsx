import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { DemoButton } from "@/components/marketing/demo-button";
import { SignupForm } from "../auth-form";
import { AuthDivider, AuthHeading } from "../auth-parts";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <>
      <AuthHeading
        title={
          <>
            Start swiping <em className="text-accent">smarter</em>
          </>
        }
        subtitle="Free account. Add your cards and get your playbook in minutes."
      />
      <SignupForm />

      <p className="mt-4 flex items-start gap-2 text-xs text-faint">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-good" />
        We never ask for full card numbers, CVV or expiry dates.
      </p>

      <AuthDivider />
      <DemoButton label="Try the demo instead" variant="secondary" size="lg" className="w-full" />

      <p className="mt-8 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-ink underline-offset-4 hover:text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
