import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

/** Optimistic redirects only; pages and actions still verify via requireUser(). */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const signedIn = Boolean(await verifySession(request.cookies.get(SESSION_COOKIE)?.value));

  if (pathname.startsWith("/app") && !signedIn) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if ((pathname === "/login" || pathname === "/signup") && signedIn) {
    return NextResponse.redirect(new URL("/app", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/login", "/signup"],
};
