"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  createLedgerEntry,
  updateLedgerEntry,
  type ActionState,
} from "@/app/(protected)/ledger/actions";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";

type LedgerFormProps = {
  mode: "create";
  defaultType: "game_debt" | "free_play";
} | {
  mode: "edit";
  id: number;
  defaultType: "game_debt" | "free_play";
  defaultValues: {
    playerName: string;
    dateIssued: string;
    amount: number;
    paid: boolean;
    notes: string | null;
  };
};

export function LedgerForm(props: LedgerFormProps) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const action =
    props.mode === "edit"
      ? updateLedgerEntry.bind(null, props.id)
      : createLedgerEntry;

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    {}
  );

  useEffect(() => {
    if (state.success) {
      setOpen(false);
      formRef.current?.reset();
      toast.success(
        props.mode === "edit" ? "Entry updated" : "Entry created"
      );
    }
    if (state.error) {
      toast.error(state.error);
    }
  }, [state, props.mode]);

  const defaults =
    props.mode === "edit"
      ? props.defaultValues
      : { playerName: "", dateIssued: "", amount: 0, paid: false, notes: "" };

  const typeLabel = props.defaultType === "game_debt" ? "Game Debt" : "Free Play";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {props.mode === "create" ? (
          <Button size="sm">
            <Plus className="size-4" />
            Add {typeLabel}
          </Button>
        ) : (
          <Button variant="ghost" size="icon-xs">
            <Pencil className="size-3" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {props.mode === "edit" ? `Edit ${typeLabel}` : `New ${typeLabel}`}
          </DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4">
          <input type="hidden" name="type" value={props.defaultType} />
          <div className="space-y-2">
            <Label htmlFor="playerName">Player Name</Label>
            <Input
              id="playerName"
              name="playerName"
              required
              defaultValue={defaults.playerName}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dateIssued">Date Issued</Label>
            <Input
              id="dateIssued"
              name="dateIssued"
              type="date"
              required
              defaultValue={defaults.dateIssued}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">Amount ($)</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              defaultValue={defaults.amount || ""}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="paid"
              name="paid"
              type="checkbox"
              defaultChecked={defaults.paid}
              value="true"
              className="size-4 rounded border-gray-300"
            />
            <Label htmlFor="paid">Paid</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={2}
              defaultValue={defaults.notes ?? ""}
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending
              ? "Saving..."
              : props.mode === "edit"
                ? "Update"
                : "Create"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
