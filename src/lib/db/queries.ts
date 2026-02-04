import { db } from ".";
import { gameNights, expenses, ledgerEntries, payrollEntries } from "./schema";
import { eq, desc, asc, sql, and, gte, lte, sum } from "drizzle-orm";
import { KAM_NIGHTLY_PAY } from "@/lib/constants";

// ─── Game Nights ─────────────────────────────────────────────────────────────

export async function getGameNights(filters?: {
  startDate?: string;
  endDate?: string;
  sort?: string;
  dir?: "asc" | "desc";
}) {
  const conditions = [];
  if (filters?.startDate) {
    conditions.push(gte(gameNights.date, filters.startDate));
  }
  if (filters?.endDate) {
    conditions.push(lte(gameNights.date, filters.endDate));
  }

  const orderCol = gameNights.date;
  const orderDir = filters?.dir === "asc" ? asc(orderCol) : desc(orderCol);

  const nights = await db
    .select()
    .from(gameNights)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(orderDir);

  // Get expense totals per game night in one query
  const expenseTotals = await db
    .select({
      gameNightId: expenses.gameNightId,
      total: sum(expenses.amount).as("total"),
    })
    .from(expenses)
    .groupBy(expenses.gameNightId);

  const expenseMap = new Map(
    expenseTotals.map((e) => [e.gameNightId, Number(e.total) || 0])
  );

  return nights.map((night) => {
    const expenseTotal = expenseMap.get(night.id) || 0;
    const rake = Number(night.rakeCollected);
    return {
      ...night,
      dayOfWeek: new Date(night.date + "T12:00:00").toLocaleDateString(
        "en-US",
        { weekday: "long" }
      ),
      weekNumber: getISOWeek(night.date),
      expenseTotal,
      netProfit: rake - expenseTotal - KAM_NIGHTLY_PAY,
    };
  });
}

export async function getGameNightById(id: number) {
  const [night] = await db
    .select()
    .from(gameNights)
    .where(eq(gameNights.id, id));
  return night ?? null;
}

export async function getExpensesForGameNight(gameNightId: number) {
  return db
    .select()
    .from(expenses)
    .where(eq(expenses.gameNightId, gameNightId))
    .orderBy(desc(expenses.createdAt));
}

export async function getAllExpensesGrouped() {
  const allExpenses = await db
    .select()
    .from(expenses)
    .orderBy(desc(expenses.createdAt));

  const map = new Map<number, typeof allExpenses>();
  for (const expense of allExpenses) {
    if (expense.gameNightId == null) continue;
    const existing = map.get(expense.gameNightId);
    if (existing) {
      existing.push(expense);
    } else {
      map.set(expense.gameNightId, [expense]);
    }
  }
  return map;
}

// ─── Ledger ──────────────────────────────────────────────────────────────────

export async function getLedgerEntries(filters?: {
  type?: "game_debt" | "free_play";
  paid?: boolean;
}) {
  const conditions = [];
  if (filters?.type) {
    conditions.push(eq(ledgerEntries.type, filters.type));
  }
  if (filters?.paid !== undefined) {
    conditions.push(eq(ledgerEntries.paid, filters.paid));
  }

  return db
    .select()
    .from(ledgerEntries)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(ledgerEntries.dateIssued));
}

export async function getLedgerSummary() {
  const [result] = await db
    .select({
      totalUnpaidDebts: sql<number>`coalesce(sum(case when type = 'game_debt' and paid = false then amount::numeric else 0 end), 0)`,
      totalUnpaidFreePlay: sql<number>`coalesce(sum(case when type = 'free_play' and paid = false then amount::numeric else 0 end), 0)`,
    })
    .from(ledgerEntries);
  return result;
}

// ─── Payroll ─────────────────────────────────────────────────────────────────

export async function getPayrollEntries(filters?: { paid?: boolean }) {
  const conditions = [];
  if (filters?.paid !== undefined) {
    conditions.push(eq(payrollEntries.paid, filters.paid));
  }

  return db
    .select()
    .from(payrollEntries)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(payrollEntries.date));
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export async function getDashboardStats() {
  // All game nights with computed profit
  const nights = await getGameNights();

  const totalGameNights = nights.length;
  const totalProfit = nights.reduce((sum, n) => sum + n.netProfit, 0);
  const avgProfit = totalGameNights > 0 ? totalProfit / totalGameNights : 0;

  let biggestWin = 0;
  let biggestLoss = 0;
  let biggestWinDate = "";
  let biggestLossDate = "";

  for (const n of nights) {
    if (n.netProfit > biggestWin) {
      biggestWin = n.netProfit;
      biggestWinDate = n.date;
    }
    if (n.netProfit < biggestLoss) {
      biggestLoss = n.netProfit;
      biggestLossDate = n.date;
    }
  }

  // This week's profit
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  const startOfWeekStr = startOfWeek.toISOString().split("T")[0];
  const thisWeekProfit = nights
    .filter((n) => n.date >= startOfWeekStr)
    .reduce((sum, n) => sum + n.netProfit, 0);

  // Outstanding debts
  const ledgerSummary = await getLedgerSummary();

  return {
    totalProfit,
    thisWeekProfit,
    totalGameNights,
    avgProfit,
    biggestWin,
    biggestWinDate,
    biggestLoss,
    biggestLossDate,
    outstandingDebts: Number(ledgerSummary.totalUnpaidDebts),
    outstandingFreePlay: Number(ledgerSummary.totalUnpaidFreePlay),
  };
}

export async function getWeeklyPnL() {
  const nights = await getGameNights({ sort: "date", dir: "asc" });

  const weeklyMap = new Map<
    number,
    { week: number; year: number; profit: number; label: string }
  >();

  for (const night of nights) {
    const d = new Date(night.date + "T12:00:00");
    const week = getISOWeek(night.date);
    const year = d.getFullYear();
    const key = year * 100 + week;

    const existing = weeklyMap.get(key);
    if (existing) {
      existing.profit += night.netProfit;
    } else {
      weeklyMap.set(key, {
        week,
        year,
        profit: night.netProfit,
        label: `W${week}`,
      });
    }
  }

  // Include payroll expenses per week
  const payroll = await db.select().from(payrollEntries);
  for (const entry of payroll) {
    const d = new Date(entry.date + "T12:00:00");
    const week = getISOWeek(entry.date);
    const year = d.getFullYear();
    const key = year * 100 + week;

    const existing = weeklyMap.get(key);
    if (existing) {
      existing.profit -= Number(entry.amount);
    }
    // If no game night that week, payroll is pure expense — skip for chart simplicity
  }

  return Array.from(weeklyMap.values()).sort(
    (a, b) => a.year * 100 + a.week - (b.year * 100 + b.week)
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getISOWeek(dateStr: string): number {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
