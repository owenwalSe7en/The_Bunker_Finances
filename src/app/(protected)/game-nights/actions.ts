"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { gameNights, expenses } from "@/lib/db/schema";
import { gameNightSchema, expenseSchema } from "@/lib/validations";
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
  const parsed = gameNightSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    await db.insert(gameNights).values({
      date: parsed.data.date,
      rakeCollected: String(parsed.data.rakeCollected),
      notes: parsed.data.notes || null,
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("unique")) {
      return { error: "A game night already exists for that date." };
    }
    return { error: "Failed to create game night." };
  }

  revalidatePath("/game-nights");
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
