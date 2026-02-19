"use server";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function verifyAuth() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Unauthorized: Authentication required");
  }

  // Check email allowlist
  const allowedEmails = process.env.ALLOWED_EMAILS?.split(",").map(e => e.trim()) ?? [];
  if (!allowedEmails.includes(user.email ?? "")) {
    throw new Error("Forbidden: User not authorized for this application");
  }

  return user;
}
