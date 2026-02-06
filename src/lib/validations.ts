import { z } from "zod";

export const houseSchema = z.object({
  owner: z.string()
    .min(1, "Owner name is required")
    .max(50, "Owner name too long")
    .regex(/^[a-zA-Z\s\-']+$/, "Owner name contains invalid characters"),
  nightlyRent: z.coerce
    .number()
    .min(1, "Rent must be at least $1")
    .max(10000, "Rent cannot exceed $10,000")
    .multipleOf(0.01, "Rent must be a valid dollar amount"),
});

export type HouseFormData = z.infer<typeof houseSchema>;

export const gameNightSchema = z.object({
  date: z.string().min(1, "Date is required"),
  rakeCollected: z.coerce
    .number()
    .min(0, "Rake must be 0 or more")
    .default(0),
  houseId: z.coerce
    .number()
    .int("House ID must be an integer")
    .positive("House selection is required"),
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
