"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import {
  toggleLedgerPaid,
  deleteLedgerEntry,
} from "@/app/(protected)/ledger/actions";
import { toast } from "sonner";

type LedgerEntry = {
  id: number;
  playerName: string;
  dateIssued: string;
  amount: string;
  paid: boolean;
  notes: string | null;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export function LedgerTable({
  entries,
  editButtons,
}: {
  entries: LedgerEntry[];
  editButtons: Record<number, React.ReactNode>;
}) {
  async function handleTogglePaid(id: number, currentPaid: boolean) {
    const result = await toggleLedgerPaid(id, !currentPaid);
    if (result.error) {
      toast.error(result.error);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this entry?")) return;
    const result = await deleteLedgerEntry(id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Entry deleted");
    }
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-muted-foreground">
        No entries yet.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Player</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden sm:table-cell">Notes</TableHead>
          <TableHead className="text-right w-20" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell>{entry.dateIssued}</TableCell>
            <TableCell className="font-medium">{entry.playerName}</TableCell>
            <TableCell className="text-right">
              {formatCurrency(Number(entry.amount))}
            </TableCell>
            <TableCell>
              <button
                onClick={() => handleTogglePaid(entry.id, entry.paid)}
                className="cursor-pointer"
              >
                <Badge variant={entry.paid ? "default" : "secondary"}>
                  {entry.paid ? "Paid" : "Unpaid"}
                </Badge>
              </button>
            </TableCell>
            <TableCell className="hidden sm:table-cell text-muted-foreground text-xs max-w-[200px] truncate">
              {entry.notes ?? "—"}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-1">
                {editButtons[entry.id]}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(entry.id)}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
