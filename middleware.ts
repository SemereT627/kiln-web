import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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

  // Locale redirect: prefix all non-API, non-asset, non-locale paths with /en
  const hasLocale = pathname.startsWith("/en");
  const isApi = pathname.startsWith("/api");
  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/signup");

  if (!hasLocale && !isApi) {
    const localeUrl = request.nextUrl.clone();
    localeUrl.pathname = `/en${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(localeUrl);
  }

  // API routes enforce their own auth (requireAdmin / RLS) — never redirect them.
  if (isApi) {
    return supabaseResponse;
  }

  // Strip /en prefix for auth checks below
  const strippedPath = hasLocale ? pathname.slice(3) || "/" : pathname;
  const isAuthPath = strippedPath.startsWith("/login") || strippedPath.startsWith("/signup");

  if (!user && !isAuthPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/en/login";
    return NextResponse.redirect(loginUrl);
  }

  if (user && isAuthPath) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/en";
    return NextResponse.redirect(homeUrl);
  }

  // Protect /admin routes
  if (strippedPath.startsWith("/admin")) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user?.id)
      .single();

    if (profile?.role !== "admin") {
      const homeUrl = request.nextUrl.clone();
      homeUrl.pathname = "/";
      return NextResponse.redirect(homeUrl);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
