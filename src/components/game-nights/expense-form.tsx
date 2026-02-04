"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createExpense,
  type ActionState,
} from "@/app/(protected)/game-nights/actions";
import { toast } from "sonner";
import { Plus } from "lucide-react";

const CATEGORIES = [
  { value: "in_game_food", label: "Food & Drink" },
  { value: "restock", label: "Restock" },
  { value: "other", label: "Other" },
];

export function ExpenseForm({ gameNightId }: { gameNightId: number }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [category, setCategory] = useState("");

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createExpense,
    {}
  );

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      setCategory("");
      toast.success("Expense added");
    }
    if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-wrap items-end gap-2"
    >
      <input type="hidden" name="gameNightId" value={gameNightId} />
      <input type="hidden" name="category" value={category} />
      <div className="space-y-1">
        <Label htmlFor={`category-${gameNightId}`} className="text-xs">
          Category
        </Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger
            id={`category-${gameNightId}`}
            className="w-[140px] h-8 text-xs"
          >
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`desc-${gameNightId}`} className="text-xs">
          Description
        </Label>
        <Input
          id={`desc-${gameNightId}`}
          name="description"
          placeholder="Optional"
          className="w-[140px] h-8 text-xs"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`amount-${gameNightId}`} className="text-xs">
          Amount ($)
        </Label>
        <Input
          id={`amount-${gameNightId}`}
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          required
          className="w-[100px] h-8 text-xs"
        />
      </div>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        <Plus className="size-3" />
        {pending ? "..." : "Add"}
      </Button>
    </form>
  );
}
