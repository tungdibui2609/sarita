import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isDashboard = pathname.startsWith("/dashboard");
  const isLogin = pathname === "/";
  const hasAuth = req.cookies.get("wms_auth")?.value === "1";

  // Protect dashboard
  if (isDashboard && !hasAuth) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Redirect logged-in users away from login page
  if (isLogin && hasAuth) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Keep pretty URL: rewrite /xhd/:slug to /print/inbound?slug=:slug&via=xhd without changing the address bar
  // Use the `slug` query param here (not `code`) so the client can prefer slug and avoid exposing internal codes.
  if (pathname.startsWith("/xhd/")) {
    const slug = pathname.slice("/xhd/".length).split("/")[0] || "";
    const url = req.nextUrl.clone();
    url.pathname = "/print/inbound";
    url.searchParams.set("slug", slug);
    url.searchParams.set("via", "xhd");
    return NextResponse.rewrite(url);
  }

  // Block direct access to print pages unless it comes via /xhd rewrite
  if (pathname.startsWith("/print/inbound")) {
    const via = req.nextUrl.searchParams.get("via");
    if (via !== "xhd") {
      return new NextResponse("Not found", { status: 404 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/xhd/:path*", "/print/:path*"],
};
