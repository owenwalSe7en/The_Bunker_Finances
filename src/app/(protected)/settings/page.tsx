import { getAppConfig } from "@/lib/db/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsForm } from "@/components/settings/settings-form";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export default async function SettingsPage() {
  const config = await getAppConfig();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Nightly Rent (Kam)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <p className="text-2xl font-bold">
              {formatCurrency(Number(config.nightlyRent))}
            </p>
            <SettingsForm currentRent={Number(config.nightlyRent)} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Auto-added as an expense each game night. Changes only affect future
            nights.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
