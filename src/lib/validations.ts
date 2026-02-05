import { z } from "zod";

export const gameNightSchema = z.object({
  date: z.string().min(1, "Date is required"),
  rakeCollected: z.coerce
    .number()
    .min(0, "Rake must be 0 or more")
    .default(0),
  notes: z.string().optional(),
});

export const expenseSchema = z.object({
  gameNightId: z.coerce.number().int().positive(),
  category: z.enum(["in_game_food", "restock", "other", "rent"], {
    message: "Category is required",
  }),
  description: z.string().optional(),
  amount: z.coerce.number().positive("Amount must be positive"),
});

export const ledgerEntrySchema = z.object({
  playerName: z.string().min(1, "Player name is required"),
  dateIssued: z.string().min(1, "Date is required"),
  type: z.enum(["game_debt", "free_play"], {
    message: "Type is required",
  }),
  amount: z.coerce.number().positive("Amount must be positive"),
  paid: z.coerce.boolean().default(false),
  notes: z.string().optional(),
});

export const appConfigSchema = z.object({
  nightlyRent: z.coerce
    .number()
    .min(0, "Nightly rent must be 0 or more"),
});

export const payrollEntrySchema = z.object({
  date: z.string().min(1, "Date is required"),
  name: z.string().min(1, "Name is required"),
  amount: z.coerce.number().positive("Amount must be positive"),
  paid: z.coerce.boolean().default(false),
  notes: z.string().optional(),
});
