"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, deleteSession } from "@/lib/session";

export type AuthState = { error?: string; fields?: Record<string, string> } | undefined;

const SignupSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export async function signup(_: AuthState, formData: FormData): Promise<AuthState> {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = SignupSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields: { name: raw.name, email: raw.email } };

  const { name, email, password } = parsed.data;
  if (await db.user.findUnique({ where: { email } })) {
    return { error: "An account with this email already exists", fields: { name, email } };
  }
  const user = await db.user.create({ data: { name, email, passwordHash: await bcrypt.hash(password, 10) } });
  await createSession(user.id);
  redirect("/app/wallet?welcome=1");
}

export async function login(_: AuthState, formData: FormData): Promise<AuthState> {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = LoginSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields: { email: raw.email } };

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return { error: "Incorrect email or password", fields: { email: raw.email } };
  }
  await createSession(user.id);
  redirect("/app");
}

/** Signs into the seeded demo account. */
export async function demoLogin() {
  const user = await db.user.findUnique({ where: { email: "demo@swipewise.app" } });
  if (!user) redirect("/login?error=demo");
  await createSession(user.id);
  redirect("/app");
}

export async function logout() {
  await deleteSession();
  redirect("/");
}
