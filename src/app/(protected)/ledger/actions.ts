"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { ledgerEntries } from "@/lib/db/schema";
import { ledgerEntrySchema } from "@/lib/validations";
import { eq } from "drizzle-orm";

export type ActionState = {
  success?: boolean;
  error?: string;
};

export async function createLedgerEntry(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = ledgerEntrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    await db.insert(ledgerEntries).values({
      playerName: parsed.data.playerName,
      dateIssued: parsed.data.dateIssued,
      type: parsed.data.type,
      amount: String(parsed.data.amount),
      paid: parsed.data.paid,
      notes: parsed.data.notes || null,
    });
  } catch {
    return { error: "Failed to create ledger entry." };
  }

  revalidatePath("/ledger");
  return { success: true };
}

export async function updateLedgerEntry(
  id: number,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = ledgerEntrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    await db
      .update(ledgerEntries)
      .set({
        playerName: parsed.data.playerName,
        dateIssued: parsed.data.dateIssued,
        type: parsed.data.type,
        amount: String(parsed.data.amount),
        paid: parsed.data.paid,
        notes: parsed.data.notes || null,
        updatedAt: new Date(),
      })
      .where(eq(ledgerEntries.id, id));
  } catch {
    return { error: "Failed to update ledger entry." };
  }

  revalidatePath("/ledger");
  return { success: true };
}

export async function toggleLedgerPaid(id: number, paid: boolean): Promise<ActionState> {
  try {
    await db
      .update(ledgerEntries)
      .set({ paid, updatedAt: new Date() })
      .where(eq(ledgerEntries.id, id));
  } catch {
    return { error: "Failed to update status." };
  }

  revalidatePath("/ledger");
  return { success: true };
}

export async function deleteLedgerEntry(id: number): Promise<ActionState> {
  try {
    await db.delete(ledgerEntries).where(eq(ledgerEntries.id, id));
  } catch {
    return { error: "Failed to delete ledger entry." };
  }

  revalidatePath("/ledger");
  return { success: true };
}
