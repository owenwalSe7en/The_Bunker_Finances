"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { gameNights, expenses, appConfig, houses } from "@/lib/db/schema";
import { gameNightSchema, expenseSchema } from "@/lib/validations";
import { verifyAuth } from "@/lib/auth/server-auth";
import { eq } from "drizzle-orm";

export type ActionState = {
  success?: boolean;
  error?: string;
};

// ─── Game Nights ─────────────────────────────────────────────────────────────

export async function createGameNight(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  // AUTHENTICATION CHECK (P1 Critical Fix)
  try {
    await verifyAuth();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unauthorized" };
  }

  const parsed = gameNightSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // VALIDATE HOUSE BEFORE TRANSACTION (P1 Race Condition Fix)
  const [house] = await db
    .select()
    .from(houses)
    .where(eq(houses.id, parsed.data.houseId));

  if (!house) {
    return { error: "Selected house not found" };
  }

  // Now start transaction with validated house data
  try {
    await db.transaction(async (tx) => {
      const [gameNight] = await tx
        .insert(gameNights)
        .values({
          date: parsed.data.date,
          rakeCollected: String(parsed.data.rakeCollected),
          houseId: parsed.data.houseId,
          notes: parsed.data.notes || null,
        })
        .returning();

      // Auto-create rent expense using pre-validated house data
      await tx.insert(expenses).values({
        gameNightId: gameNight.id,
        category: "rent",
        description: `Nightly rent (${house.owner})`,
        amount: house.nightlyRent,
      });
    });
  } catch (e: unknown) {
    console.error("[createGameNight] Database error:", e);

    // Specific error handling (P2 Fix)
    if (e && typeof e === 'object' && 'code' in e) {
      if (e.code === "23505") {  // Unique violation
        return { error: "A game night already exists for this date" };
      }
      if (e.code === "23503") {  // Foreign key violation
        return { error: "Selected house no longer exists" };
      }
    }

    return { error: "Failed to create game night. Please try again." };
  }

  revalidatePath("/game-nights");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateGameNight(
  id: number,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = gameNightSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    await db
      .update(gameNights)
      .set({
        date: parsed.data.date,
        rakeCollected: String(parsed.data.rakeCollected),
        notes: parsed.data.notes || null,
        updatedAt: new Date(),
      })
      .where(eq(gameNights.id, id));
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("unique")) {
      return { error: "A game night already exists for that date." };
    }
    return { error: "Failed to update game night." };
  }

  revalidatePath("/game-nights");
  return { success: true };
}

export async function deleteGameNight(id: number): Promise<ActionState> {
  try {
    await db.delete(gameNights).where(eq(gameNights.id, id));
  } catch {
    return { error: "Failed to delete game night." };
  }

  revalidatePath("/game-nights");
  return { success: true };
}

// ─── Expenses ────────────────────────────────────────────────────────────────

export async function createExpense(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = expenseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    await db.insert(expenses).values({
      gameNightId: parsed.data.gameNightId,
      category: parsed.data.category,
      description: parsed.data.description || null,
      amount: String(parsed.data.amount),
    });
  } catch {
    return { error: "Failed to create expense." };
  }

  revalidatePath("/game-nights");
  return { success: true };
}

export async function deleteExpense(id: number): Promise<ActionState> {
  try {
    await db.delete(expenses).where(eq(expenses.id, id));
  } catch {
    return { error: "Failed to delete expense." };
  }

  revalidatePath("/game-nights");
  return { success: true };
}
