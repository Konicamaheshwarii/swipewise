"use client";

import { LoaderCircle, Play } from "lucide-react";
import { useFormStatus } from "react-dom";
import { demoLogin } from "@/lib/actions/auth";
import { buttonClass } from "@/components/ui";

type Variant = "primary" | "secondary" | "outline" | "ghost";

/** Submit button that shows a spinner while its parent form is pending. */
function DemoSubmit({ label, variant, size, className }: { label: string; variant: Variant; size: "sm" | "md" | "lg"; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass(variant, size, className)}>
      {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Play className="size-4 fill-current" />}
      {pending ? "Opening demo…" : label}
    </button>
  );
}

/** One-click sign-in to the seeded demo account. */
export function DemoButton({
  label = "Try the live demo",
  variant = "primary",
  size = "lg",
  className,
  formClassName,
}: {
  label?: string;
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  className?: string;
  formClassName?: string;
}) {
  return (
    <form action={demoLogin} className={formClassName}>
      <DemoSubmit label={label} variant={variant} size={size} className={className} />
    </form>
  );
}
