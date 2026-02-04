import { getPayrollEntries } from "@/lib/db/queries";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PayrollForm } from "@/components/payroll/payroll-form";
import { PayrollActions } from "@/components/payroll/payroll-actions";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export default async function PayrollPage() {
  const entries = await getPayrollEntries();

  const totalAmount = entries.reduce((s, e) => s + Number(e.amount), 0);
  const totalUnpaid = entries
    .filter((e) => !e.paid)
    .reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payroll</h1>
          <p className="text-sm text-muted-foreground">
            {entries.length} entr{entries.length !== 1 ? "ies" : "y"}
            {totalUnpaid > 0 && (
              <> · <span className="text-red-600">{formatCurrency(totalUnpaid)} unpaid</span></>
            )}
          </p>
        </div>
        <PayrollForm mode="create" />
      </div>

      {entries.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          No payroll entries yet.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden sm:table-cell">Notes</TableHead>
              <TableHead className="text-right w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>{entry.date}</TableCell>
                <TableCell className="font-medium">{entry.name}</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(Number(entry.amount))}
                </TableCell>
                <TableCell>
                  <PayrollActions
                    id={entry.id}
                    paid={entry.paid}
                  />
                </TableCell>
                <TableCell className="hidden sm:table-cell text-muted-foreground text-xs max-w-[200px] truncate">
                  {entry.notes ?? "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <PayrollForm
                      mode="edit"
                      id={entry.id}
                      defaultValues={{
                        date: entry.date,
                        name: entry.name,
                        amount: Number(entry.amount),
                        paid: entry.paid,
                        notes: entry.notes,
                      }}
                    />
                    <PayrollActions id={entry.id} deleteButton />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="font-bold">Total</TableCell>
              <TableCell />
              <TableCell className="text-right font-bold">
                {formatCurrency(totalAmount)}
              </TableCell>
              <TableCell colSpan={3} />
            </TableRow>
          </TableFooter>
        </Table>
      )}
    </div>
  );
}
