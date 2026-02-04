"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { ExpenseForm } from "./expense-form";
import { deleteExpense } from "@/app/(protected)/game-nights/actions";
import { toast } from "sonner";

type Expense = {
  id: number;
  category: string;
  description: string | null;
  amount: string;
};

type GameNightRowProps = {
  night: {
    id: number;
    date: string;
    dayOfWeek: string;
    rakeCollected: string;
    expenseTotal: number;
    netProfit: number;
    notes: string | null;
  };
  expenses: Expense[];
  editButton: React.ReactNode;
  deleteButton: React.ReactNode;
};

const CATEGORY_LABELS: Record<string, string> = {
  in_game_food: "Food & Drink",
  restock: "Restock",
  other: "Other",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export function GameNightRow({
  night,
  expenses,
  editButton,
  deleteButton,
}: GameNightRowProps) {
  const [expanded, setExpanded] = useState(false);

  async function handleDeleteExpense(id: number) {
    const result = await deleteExpense(id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Expense deleted");
    }
  }

  return (
    <>
      <TableRow
        className="cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <TableCell className="w-8">
          {expanded ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell className="font-medium">{night.date}</TableCell>
        <TableCell className="hidden sm:table-cell">{night.dayOfWeek}</TableCell>
        <TableCell className="text-right">
          {formatCurrency(Number(night.rakeCollected))}
        </TableCell>
        <TableCell className="text-right">
          {formatCurrency(night.expenseTotal)}
        </TableCell>
        <TableCell
          className={`text-right font-medium ${
            night.netProfit >= 0 ? "text-green-600" : "text-red-600"
          }`}
        >
          {formatCurrency(night.netProfit)}
        </TableCell>
        <TableCell
          className="text-right"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-end gap-1">
            {editButton}
            {deleteButton}
          </div>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={7} className="bg-muted/30 p-4">
            {night.notes && (
              <p className="text-sm text-muted-foreground mb-3">
                {night.notes}
              </p>
            )}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Expenses</h4>
              {expenses.length > 0 ? (
                <div className="space-y-1">
                  {expenses.map((expense) => (
                    <div
                      key={expense.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {CATEGORY_LABELS[expense.category] ??
                            expense.category}
                        </Badge>
                        {expense.description && (
                          <span className="text-muted-foreground">
                            {expense.description}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span>{formatCurrency(Number(expense.amount))}</span>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteExpense(expense.id)}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No expenses recorded.
                </p>
              )}
              <ExpenseForm gameNightId={night.id} />
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
