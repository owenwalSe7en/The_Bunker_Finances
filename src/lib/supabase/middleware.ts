import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
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
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresh expired sessions
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublicRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/not-authorized");

  // Redirect unauthenticated users to login
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Allowlist check: if user is authenticated but not on the allowlist, sign them out
  if (user && !isPublicRoute) {
    const allowedEmails =
      process.env.ALLOWED_EMAILS?.split(",").map((e) => e.trim()) ?? [];
    if (!allowedEmails.includes(user.email ?? "")) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/not-authorized";
      return NextResponse.redirect(url);
    }
  }

  // Redirect authenticated users away from login
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/game-nights";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
