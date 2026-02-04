"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import {
  togglePayrollPaid,
  deletePayrollEntry,
} from "@/app/(protected)/payroll/actions";
import { toast } from "sonner";

type PayrollActionsProps =
  | { id: number; paid: boolean; deleteButton?: never }
  | { id: number; deleteButton: true; paid?: never };

export function PayrollActions(props: PayrollActionsProps) {
  if ("deleteButton" in props && props.deleteButton) {
    async function handleDelete() {
      if (!confirm("Delete this payroll entry?")) return;
      const result = await deletePayrollEntry(props.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Entry deleted");
      }
    }

    return (
      <Button
        variant="ghost"
        size="icon-xs"
        className="text-muted-foreground hover:text-destructive"
        onClick={handleDelete}
      >
        <Trash2 className="size-3" />
      </Button>
    );
  }

  async function handleToggle() {
    const result = await togglePayrollPaid(props.id, !props.paid);
    if (result.error) {
      toast.error(result.error);
    }
  }

  return (
    <button onClick={handleToggle} className="cursor-pointer">
      <Badge variant={props.paid ? "default" : "secondary"}>
        {props.paid ? "Paid" : "Unpaid"}
      </Badge>
    </button>
  );
}
