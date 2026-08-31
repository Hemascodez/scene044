import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { CURATOR_SESSION_COOKIE, checkCuratorAuth, isCuratorSessionValid } from "@/lib/auth";

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

/** The only routes under the guarded prefixes that must stay reachable while
 *  unauthenticated — otherwise there is no way to log in. */
const PUBLIC_ADMIN_PATHS = new Set(["/admin/login", "/api/admin/login", "/api/admin/logout"]);

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_ADMIN_PATHS.has(pathname)) return NextResponse.next();

  const authorized =
    checkCuratorAuth(req) ||
    (await isCuratorSessionValid(req.cookies.get(CURATOR_SESSION_COOKIE)?.value));

  if (authorized) return NextResponse.next();

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
  // Only ever round-trip an internal admin path, so `next` can't be used as an
  // open redirect to another origin.
  if (pathname.startsWith("/admin/")) {
    loginUrl.searchParams.set("next", pathname);
  }
  return NextResponse.redirect(loginUrl);
}
