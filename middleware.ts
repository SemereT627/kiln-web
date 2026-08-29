import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getRole } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — do NOT add logic between createServerClient and getUser
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const isApi = pathname.startsWith("/api");
  // Landing page + auth screens are pre-auth, locale-agnostic surfaces — kept
  // outside the /en locale scheme entirely (never prefixed, never gated).
  const isPublicRoute =
    pathname === "/" || pathname.startsWith("/login") || pathname.startsWith("/signup");
  const hasLocale = pathname.startsWith("/en");

  // API routes enforce their own auth (requireAdmin / RLS) — never redirect them.
  if (isApi) {
    return supabaseResponse;
  }

  if (isPublicRoute) {
    // Already signed in — these routes have nothing left to offer.
    if (user) {
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = "/en/dashboard";
      return NextResponse.redirect(dashboardUrl);
    }
    return supabaseResponse;
  }

  // Locale redirect: prefix all other non-API, non-public paths with /en
  if (!hasLocale) {
    const localeUrl = request.nextUrl.clone();
    localeUrl.pathname = `/en${pathname}`;
    return NextResponse.redirect(localeUrl);
  }

  // Strip /en prefix for the auth check below
  const strippedPath = pathname.slice(3) || "/";

  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // Protect /admin routes — same role check as requireAdmin() in lib/auth.ts,
  // reused directly since it's just a service-role lookup by id (no
  // session/cookie dependency to conflict with the client wired up above).
  if (strippedPath.startsWith("/admin")) {
    const role = await getRole(user.id);

    if (role !== "admin") {
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = "/en/dashboard";
      return NextResponse.redirect(dashboardUrl);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
