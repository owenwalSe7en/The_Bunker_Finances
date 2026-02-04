"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { payrollEntries } from "@/lib/db/schema";
import { payrollEntrySchema } from "@/lib/validations";
import { eq } from "drizzle-orm";

export type ActionState = {
  success?: boolean;
  error?: string;
};

export async function createPayrollEntry(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = payrollEntrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    await db.insert(payrollEntries).values({
      date: parsed.data.date,
      name: parsed.data.name,
      amount: String(parsed.data.amount),
      paid: parsed.data.paid,
      notes: parsed.data.notes || null,
    });
  } catch {
    return { error: "Failed to create payroll entry." };
  }

  revalidatePath("/payroll");
  return { success: true };
}

export async function updatePayrollEntry(
  id: number,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = payrollEntrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    await db
      .update(payrollEntries)
      .set({
        date: parsed.data.date,
        name: parsed.data.name,
        amount: String(parsed.data.amount),
        paid: parsed.data.paid,
        notes: parsed.data.notes || null,
        updatedAt: new Date(),
      })
      .where(eq(payrollEntries.id, id));
  } catch {
    return { error: "Failed to update payroll entry." };
  }

  revalidatePath("/payroll");
  return { success: true };
}

export async function togglePayrollPaid(id: number, paid: boolean): Promise<ActionState> {
  try {
    await db
      .update(payrollEntries)
      .set({ paid, updatedAt: new Date() })
      .where(eq(payrollEntries.id, id));
  } catch {
    return { error: "Failed to update status." };
  }

  revalidatePath("/payroll");
  return { success: true };
}

export async function deletePayrollEntry(id: number): Promise<ActionState> {
  try {
    await db.delete(payrollEntries).where(eq(payrollEntries.id, id));
  } catch {
    return { error: "Failed to delete payroll entry." };
  }

  revalidatePath("/payroll");
  return { success: true };
}
