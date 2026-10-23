"use client";

import { useActionState, useState } from "react";
import { AlertCircle, ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { login, signup, type AuthState } from "@/lib/actions/auth";
import { Button, Field, Input } from "@/components/ui";

function ErrorNote({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="flex items-start gap-2 rounded-xl border border-bad/25 bg-bad/10 px-3 py-2.5 text-sm text-bad">
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      {message}
    </p>
  );
}

function PasswordInput({ autoComplete, minLength }: { autoComplete: string; minLength?: number }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        name="password"
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        minLength={minLength}
        required
        placeholder="••••••••"
        className="h-11 pr-10"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-faint transition-colors hover:text-ink"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function Submit({ pending, label, pendingLabel }: { pending: boolean; label: string; pendingLabel: string }) {
  return (
    <Button type="submit" size="lg" disabled={pending} className="mt-2 w-full">
      {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
      {pending ? pendingLabel : label}
      {!pending && <ArrowRight className="size-4" />}
    </Button>
  );
}

export function LoginForm({ initialError }: { initialError?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(login, undefined);
  const error = state?.error ?? (state ? undefined : initialError);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <ErrorNote message={error} />
      <Field label="Email">
        <Input
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          defaultValue={state?.fields?.email}
          key={state?.fields?.email}
          className="h-11"
        />
      </Field>
      <Field label="Password">
        <PasswordInput autoComplete="current-password" />
      </Field>
      <Submit pending={pending} label="Sign in" pendingLabel="Signing in…" />
    </form>
  );
}

export function SignupForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(signup, undefined);
  const fields = state?.fields;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <ErrorNote message={state?.error} />
      <Field label="Name">
        <Input
          name="name"
          autoComplete="name"
          required
          placeholder="Priya Sharma"
          defaultValue={fields?.name}
          key={`n-${fields?.name ?? ""}`}
          className="h-11"
        />
      </Field>
      <Field label="Email">
        <Input
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          defaultValue={fields?.email}
          key={`e-${fields?.email ?? ""}`}
          className="h-11"
        />
      </Field>
      <Field label="Password" hint="At least 8 characters.">
        <PasswordInput autoComplete="new-password" minLength={8} />
      </Field>
      <Submit pending={pending} label="Create account" pendingLabel="Creating account…" />
    </form>
  );
}
