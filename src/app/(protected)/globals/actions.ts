"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { houses } from "@/lib/db/schema";
import { houseSchema } from "@/lib/validations";
import { verifyAuth } from "@/lib/auth/server-auth";
import { eq } from "drizzle-orm";

export async function createHouseAction(formData: FormData) {
  // AUTHENTICATION CHECK (P1 Critical Fix)
  try {
    await verifyAuth();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unauthorized" };
  }

  const data = {
    owner: formData.get("owner") as string,
    nightlyRent: formData.get("nightlyRent") as string,
  };

  const result = houseSchema.safeParse(data);
  if (!result.success) {
    return { error: result.error.errors[0].message };
  }

  try {
    // Use Drizzle directly - no wrapper function (DHH simplification)
    await db.insert(houses).values({
      owner: result.data.owner,
      nightlyRent: result.data.nightlyRent.toString(),
    });

    revalidatePath("/globals");
    revalidatePath("/game-nights");
    return { success: true };
  } catch (error) {
    // Improved error handling (P2 Fix)
    console.error("[createHouse] Database error:", error);

    if (error instanceof Error && error.message.includes("unique")) {
      return { error: "A house for this owner already exists" };
    }

    return { error: "Failed to create house. Please try again." };
  }
}

export async function updateHouseAction(id: number, formData: FormData) {
  // AUTHENTICATION CHECK (P1 Critical Fix)
  try {
    await verifyAuth();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unauthorized" };
  }

  // Input validation (P2 Fix)
  if (!Number.isInteger(id) || id <= 0) {
    return { error: "Invalid house ID" };
  }

  const data = {
    owner: formData.get("owner") as string,
    nightlyRent: formData.get("nightlyRent") as string,
  };

  const result = houseSchema.safeParse(data);
  if (!result.success) {
    return { error: result.error.errors[0].message };
  }

  try {
    // Use Drizzle directly (DHH simplification)
    const [updated] = await db
      .update(houses)
      .set({
        owner: result.data.owner,
        nightlyRent: result.data.nightlyRent.toString(),
      })
      .where(eq(houses.id, id))
      .returning();

    if (!updated) {
      return { error: "House not found" };
    }

    revalidatePath("/globals");
    revalidatePath("/game-nights");
    return { success: true };
  } catch (error) {
    console.error("[updateHouse] Database error:", error);

    if (error instanceof Error && error.message.includes("unique")) {
      return { error: "A house for this owner already exists" };
    }

    return { error: "Failed to update house. Please try again." };
  }
}

export async function deleteHouseAction(id: number) {
  // AUTHENTICATION CHECK (P1 Critical Fix)
  try {
    await verifyAuth();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unauthorized" };
  }

  // Input validation (P2 Fix)
  if (!Number.isInteger(id) || id <= 0) {
    return { error: "Invalid house ID" };
  }

  try {
    // Hard delete with RESTRICT protection (DHH simplification - no soft delete)
    await db.delete(houses).where(eq(houses.id, id));

    revalidatePath("/globals");
    revalidatePath("/game-nights");
    return { success: true };
  } catch (error: unknown) {
    console.error("[deleteHouse] Database error:", error);

    // Type guard for PostgreSQL error (P2 Fix)
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === "23503") {  // Foreign key violation
        return {
          error: "Cannot delete house with existing game nights. Delete the game nights first."
        };
      }
    }

    return { error: "Failed to delete house. Please try again." };
  }
}
