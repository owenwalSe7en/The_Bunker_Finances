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
  createPayrollEntry,
  updatePayrollEntry,
  type ActionState,
} from "@/app/(protected)/payroll/actions";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";

type PayrollFormProps = {
  mode: "create";
} | {
  mode: "edit";
  id: number;
  defaultValues: {
    date: string;
    name: string;
    amount: number;
    paid: boolean;
    notes: string | null;
  };
};

export function PayrollForm(props: PayrollFormProps) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const action =
    props.mode === "edit"
      ? updatePayrollEntry.bind(null, props.id)
      : createPayrollEntry;

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
      : { date: "", name: "", amount: 0, paid: false, notes: "" };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {props.mode === "create" ? (
          <Button size="sm">
            <Plus className="size-4" />
            Add Entry
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
            {props.mode === "edit" ? "Edit Payroll Entry" : "New Payroll Entry"}
          </DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              name="date"
              type="date"
              required
              defaultValue={defaults.date}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              required
              defaultValue={defaults.name}
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
