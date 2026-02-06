import { getGameNights, getAllExpensesGrouped, getHouses } from "@/lib/db/queries";
import {
  Table,
  TableBody,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { GameNightRow } from "@/components/game-nights/game-night-detail";
import { GameNightForm } from "@/components/game-nights/game-night-form";
import { DeleteGameNightButton } from "@/components/game-nights/delete-game-night-button";
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export default async function GameNightsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const startDate = typeof params.startDate === "string" ? params.startDate : undefined;
  const endDate = typeof params.endDate === "string" ? params.endDate : undefined;
  const dir = params.dir === "asc" ? "asc" : "desc";

  const [nights, expenseMap, houses] = await Promise.all([
    getGameNights({ startDate, endDate, dir }),
    getAllExpensesGrouped(),
    getHouses(),
  ]);

  const totalRake = nights.reduce((s, n) => s + Number(n.rakeCollected), 0);
  const totalExpenses = nights.reduce((s, n) => s + n.expenseTotal, 0);
  const totalProfit = nights.reduce((s, n) => s + n.netProfit, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Game Nights</h1>
          <p className="text-sm text-muted-foreground">
            {nights.length} night{nights.length !== 1 ? "s" : ""} recorded
          </p>
        </div>
        <GameNightForm mode="create" houses={houses} />
      </div>

      {nights.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          No game nights yet. Add your first one above.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Date</TableHead>
              <TableHead className="hidden sm:table-cell">Day</TableHead>
              <TableHead className="text-right">Rake</TableHead>
              <TableHead className="text-right">Expenses</TableHead>
              <TableHead className="text-right">Net Profit</TableHead>
              <TableHead className="text-right w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {nights.map((night) => (
              <GameNightRow
                key={night.id}
                night={night}
                expenses={
                  (expenseMap.get(night.id) ?? []).map((e) => ({
                    id: e.id,
                    category: e.category,
                    description: e.description,
                    amount: e.amount,
                  }))
                }
                editButton={
                  <GameNightForm
                    mode="edit"
                    id={night.id}
                    houses={houses}
                    defaultValues={{
                      date: night.date,
                      rakeCollected: Number(night.rakeCollected),
                      houseId: night.houseId,
                      notes: night.notes,
                    }}
                  />
                }
                deleteButton={<DeleteGameNightButton id={night.id} />}
              />
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell />
              <TableCell className="font-bold">Totals</TableCell>
              <TableCell className="hidden sm:table-cell" />
              <TableCell className="text-right font-bold">
                {formatCurrency(totalRake)}
              </TableCell>
              <TableCell className="text-right font-bold">
                {formatCurrency(totalExpenses)}
              </TableCell>
              <TableCell
                className={`text-right font-bold ${
                  totalProfit >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {formatCurrency(totalProfit)}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableFooter>
        </Table>
      )}
    </div>
  );
}
