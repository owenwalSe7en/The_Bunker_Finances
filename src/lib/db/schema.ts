import {
  pgTable,
  serial,
  date,
  numeric,
  text,
  boolean,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

// ─── Houses ──────────────────────────────────────────────────────────────────

export const houses = pgTable("houses", {
  id: serial("id").primaryKey(),
  owner: text("owner").notNull().unique(),
  nightlyRent: numeric("nightly_rent", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Game Nights ─────────────────────────────────────────────────────────────

export const gameNights = pgTable("game_nights", {
  id: serial("id").primaryKey(),
  date: date("date").notNull().unique(),
  rakeCollected: numeric("rake_collected", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  houseId: integer("house_id")
    .notNull()
    .references(() => houses.id, { onDelete: "restrict" }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  gameNightId: integer("game_night_id").references(() => gameNights.id, {
    onDelete: "cascade",
  }),
  category: text("category").notNull(), // in_game_food | restock | other | rent
  description: text("description"),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const ledgerEntries = pgTable("ledger_entries", {
  id: serial("id").primaryKey(),
  playerName: text("player_name").notNull(),
  dateIssued: date("date_issued").notNull(),
  type: text("type").notNull(), // game_debt | free_play
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  paid: boolean("paid").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const payrollEntries = pgTable("payroll_entries", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  name: text("name").notNull(),
  paid: boolean("paid").notNull().default(false),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const appConfig = pgTable("app_config", {
  id: serial("id").primaryKey(),
  nightlyRent: numeric("nightly_rent", { precision: 10, scale: 2 })
    .notNull()
    .default("330"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Type exports
export type House = typeof houses.$inferSelect;
export type NewHouse = typeof houses.$inferInsert;
export type GameNight = typeof gameNights.$inferSelect;
export type NewGameNight = typeof gameNights.$inferInsert;
export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
export type LedgerEntry = typeof ledgerEntries.$inferSelect;
export type NewLedgerEntry = typeof ledgerEntries.$inferInsert;
export type PayrollEntry = typeof payrollEntries.$inferSelect;
export type NewPayrollEntry = typeof payrollEntries.$inferInsert;
export type AppConfig = typeof appConfig.$inferSelect;
export type NewAppConfig = typeof appConfig.$inferInsert;
