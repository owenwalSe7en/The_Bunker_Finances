import { getLedgerEntries, getLedgerSummary } from "@/lib/db/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LedgerTable } from "@/components/ledger/ledger-table";
import { LedgerForm } from "@/components/ledger/ledger-form";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const tab = params.tab === "free_play" ? "free_play" : "game_debt";

  const [gameDebts, freePlay, summary] = await Promise.all([
    getLedgerEntries({ type: "game_debt" }),
    getLedgerEntries({ type: "free_play" }),
    getLedgerSummary(),
  ]);

  function buildEditButtons(
    entries: typeof gameDebts,
    type: "game_debt" | "free_play"
  ) {
    const map: Record<number, React.ReactNode> = {};
    for (const entry of entries) {
      map[entry.id] = (
        <LedgerForm
          mode="edit"
          id={entry.id}
          defaultType={type}
          defaultValues={{
            playerName: entry.playerName,
            dateIssued: entry.dateIssued,
            amount: Number(entry.amount),
            paid: entry.paid,
            notes: entry.notes,
          }}
        />
      );
    }
    return map;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">The Books</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Outstanding Debts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(Number(summary.totalUnpaidDebts))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Outstanding Free Play
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600">
              {formatCurrency(Number(summary.totalUnpaidFreePlay))}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue={tab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="game_debt">
              Game Debts ({gameDebts.length})
            </TabsTrigger>
            <TabsTrigger value="free_play">
              Free Play ({freePlay.length})
            </TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            {tab === "free_play" ? (
              <LedgerForm mode="create" defaultType="free_play" />
            ) : (
              <LedgerForm mode="create" defaultType="game_debt" />
            )}
          </div>
        </div>

        <TabsContent value="game_debt" className="mt-4">
          <LedgerTable
            entries={gameDebts}
            editButtons={buildEditButtons(gameDebts, "game_debt")}
          />
        </TabsContent>
        <TabsContent value="free_play" className="mt-4">
          <LedgerTable
            entries={freePlay}
            editButtons={buildEditButtons(freePlay, "free_play")}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
