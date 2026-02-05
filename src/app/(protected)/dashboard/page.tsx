import { getDashboardStats, getWeeklyPnL, getCurrentWeekLabel } from "@/lib/db/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PnLChart } from "@/components/dashboard/pnl-chart";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export default async function DashboardPage() {
  const [stats, weeklyPnL] = await Promise.all([
    getDashboardStats(),
    getWeeklyPnL(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              All-Time Profit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-bold ${
                stats.totalProfit >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {formatCurrency(stats.totalProfit)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-bold ${
                stats.thisWeekProfit >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {formatCurrency(stats.thisWeekProfit)}
            </p>
            <p className="text-xs text-muted-foreground">
              {getCurrentWeekLabel()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Nights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalGameNights}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Profit/Night
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-bold ${
                stats.avgProfit >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {formatCurrency(stats.avgProfit)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Biggest Win
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-green-600">
              {stats.biggestWin > 0
                ? formatCurrency(stats.biggestWin)
                : "—"}
            </p>
            {stats.biggestWinDate && (
              <p className="text-xs text-muted-foreground">
                {stats.biggestWinDate}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Biggest Loss
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-red-600">
              {stats.biggestLoss < 0
                ? formatCurrency(stats.biggestLoss)
                : "—"}
            </p>
            {stats.biggestLossDate && (
              <p className="text-xs text-muted-foreground">
                {stats.biggestLossDate}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Outstanding Debts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-red-600">
              {stats.outstandingDebts > 0
                ? formatCurrency(stats.outstandingDebts)
                : "$0.00"}
            </p>
            {stats.outstandingFreePlay > 0 && (
              <p className="text-xs text-muted-foreground">
                + {formatCurrency(stats.outstandingFreePlay)} free play
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Weekly P&L</CardTitle>
        </CardHeader>
        <CardContent>
          <PnLChart data={weeklyPnL} />
        </CardContent>
      </Card>
    </div>
  );
}
