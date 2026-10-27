import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { embedFrameAncestors } from "@/server/embed-guard";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/embed/")) {
    const key = pathname.split("/")[2] ?? "";
    let ancestors = "'self'";
    try {
      ancestors = await embedFrameAncestors(key);
    } catch {
      // Database unavailable: fail closed to our own origin.
    }
    const response = NextResponse.next();
    response.headers.set(
      "Content-Security-Policy",
      `frame-ancestors ${ancestors}`,
    );
    return response;
  }
  // Admin deep links (e.g. from Telegram) must survive the sign-in step.
  if (!getSessionCookie(request)) {
    const login = new URL("/autentificare", request.url);
    login.searchParams.set("returnTo", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }
  const headers = new Headers(request.headers);
  headers.set("x-return-to", `${pathname}${search}`);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/embed/:path*", "/admin", "/admin/:path*"],
};
