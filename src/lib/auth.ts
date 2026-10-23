import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "./db";
import { getSessionUserId } from "./session";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
}

/** Data access layer: the signed-in user, or null. Deduplicated per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const userId = await getSessionUserId();
  if (!userId) return null;
  return db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, isAdmin: true },
  });
});

/** Use in every signed-in page and server action. Redirects to /login when signed out. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.isAdmin) redirect("/app");
  return user;
}
