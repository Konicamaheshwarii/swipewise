import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { DemoButton } from "@/components/marketing/demo-button";
import { LoginForm } from "../auth-form";
import { AuthDivider, AuthHeading } from "../auth-parts";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { error } = await searchParams;
  const initialError = error === "demo" ? "The demo account isn't set up yet. Run the database seed, then try again." : undefined;

  return (
    <>
      <AuthHeading
        title={
          <>
            Welcome <em className="text-accent">back</em>
          </>
        }
        subtitle="Sign in to see which card to swipe next."
      />
      <LoginForm initialError={initialError} />

      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-line bg-surface-2/60 px-3 py-2.5 text-xs text-muted">
        <KeyRound className="mt-0.5 size-3.5 shrink-0 text-accent" />
        <p>
          Demo account: <span className="font-mono text-ink">demo@swipewise.app</span> /{" "}
          <span className="font-mono text-ink">demo1234</span>
        </p>
      </div>

      <AuthDivider />
      <DemoButton label="Try the demo instead" variant="secondary" size="lg" className="w-full" />

      <p className="mt-8 text-center text-sm text-muted">
        New to Swipewise?{" "}
        <Link href="/signup" className="font-medium text-ink underline-offset-4 hover:text-accent hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}
