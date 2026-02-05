"use server";

import { revalidatePath } from "next/cache";
import { updateAppConfig } from "@/lib/db/queries";
import { appConfigSchema } from "@/lib/validations";

export type ActionState = {
  success?: boolean;
  error?: string;
};

export async function updateNightlyRent(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = appConfigSchema.safeParse(
    Object.fromEntries(formData)
  );
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    await updateAppConfig(String(parsed.data.nightlyRent));
  } catch {
    return { error: "Failed to update nightly rent." };
  }

  revalidatePath("/settings");
  revalidatePath("/game-nights");
  revalidatePath("/dashboard");
  return { success: true };
}
