import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { CURATOR_SESSION_COOKIE, checkCuratorAuth, isCuratorSessionValid } from "@/lib/auth";
import { checkHostAccess, HOST_ACCESS_MESSAGE } from '@/lib/venueHostAccess';
import { requireEventHost } from '@/lib/eventHostAccess';
import { EventTicketError } from '@/lib/hostedEventData';
import { getVenueUserFromRequest } from '@/lib/venueUserAuth';

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/host/:path*", "/api/host/:path*"],
};

/** The only routes under the guarded prefixes that must stay reachable while
 *  unauthenticated — otherwise there is no way to log in. */
const PUBLIC_ADMIN_PATHS = new Set(["/admin/login", "/api/admin/login", "/api/admin/logout"]);

/** Curator and host credentials are separate. */
function isGuardedAdminOrHostPath(pathname: string): boolean {
  return pathname.startsWith("/admin/") || pathname.startsWith("/host/") || pathname === "/host";
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_ADMIN_PATHS.has(pathname)) return NextResponse.next();
  if (pathname === '/host/login') return NextResponse.next();

  const authorized =
    checkCuratorAuth(req) ||
    (await isCuratorSessionValid(req.cookies.get(CURATOR_SESSION_COOKIE)?.value));

  if (authorized) return NextResponse.next();
  if (pathname === '/host/events' || pathname.startsWith('/host/events/') || pathname === '/api/host/events' || pathname.startsWith('/api/host/events/')) {
    try { await requireEventHost(req); return NextResponse.next(); }
    catch (error) {
      const status=error instanceof EventTicketError ? error.status : 503;
      if (pathname.startsWith('/api/')) return NextResponse.json({error:status===503 ? 'Event sign-in is temporarily unavailable.' : error instanceof Error ? error.message : 'Sign in to run your event.'},{status});
      if (status===503) return NextResponse.json({error:'Event sign-in is temporarily unavailable.'},{status});
      return NextResponse.redirect(new URL('/host/login?next=%2Fhost%2Fevents',req.url));
    }
  }
  if (pathname === '/host') {
    try { if ((await getVenueUserFromRequest(req))?.hostEventId) return NextResponse.redirect(new URL('/host/events',req.url)); }
    catch { return NextResponse.json({error:'Host sign-in is temporarily unavailable.'},{status:503}); }
  }
  const hostPath = pathname === '/host' || pathname.startsWith('/host/') || pathname.startsWith('/api/host/');
  if (hostPath) {
    try {
      if (await checkHostAccess(req)) return NextResponse.next();
    } catch {
      // Database unavailable must fail closed, never fall back to role alone.
      return NextResponse.json({ error: 'Host sign-in is temporarily unavailable. Please retry.' }, { status: 503 });
    }
    if (pathname.startsWith('/api/')) return NextResponse.json({ error: HOST_ACCESS_MESSAGE }, { status: 403 });
    const loginUrl = new URL('/host/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  // API callers get a machine-readable 401 and no WWW-Authenticate, so a stray
  // fetch can't trigger a native auth dialog over the top of the app.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Page requests go to the real login form rather than depending on the
  // browser's built-in Basic dialog, which embedded webviews and preview panes
  // often refuse to show — leaving the visitor staring at a bare 401 body.
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/admin/login";
  loginUrl.search = "";
  // Only ever round-trip an internal admin/host path, so `next` can't be used
  // as an open redirect to another origin.
  if (isGuardedAdminOrHostPath(pathname)) {
    loginUrl.searchParams.set("next", pathname);
  }
  return NextResponse.redirect(loginUrl);
}
