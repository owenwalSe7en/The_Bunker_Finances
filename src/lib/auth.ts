import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return user;
});
