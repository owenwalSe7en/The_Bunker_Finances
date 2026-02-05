"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { Button } from "@/components/ui/button";

type WeekData = {
  week: number;
  year: number;
  profit: number;
  label: string;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function PnLChart({ data }: { data: WeekData[] }) {
  const [cumulative, setCumulative] = useState(false);

  const chartData = cumulative
    ? data.reduce<(WeekData & { cumProfit: number })[]>((acc, item) => {
        const prev = acc.length > 0 ? acc[acc.length - 1].cumProfit : 0;
        acc.push({ ...item, cumProfit: prev + item.profit });
        return acc;
      }, [])
    : data;

  const dataKey = cumulative ? "cumProfit" : "profit";

  if (data.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-muted-foreground">
        No data yet. Add some game nights to see the chart.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button
          variant={cumulative ? "default" : "outline"}
          size="xs"
          onClick={() => setCumulative(!cumulative)}
        >
          {cumulative ? "Cumulative" : "Weekly"}
        </Button>
      </div>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="label"
              className="text-xs"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis
              tickFormatter={(v: number) => formatCurrency(v)}
              className="text-xs"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              width={70}
            />
            <Tooltip
              formatter={(value) => [formatCurrency(Number(value)), cumulative ? "Cumulative P&L" : "Weekly P&L"]}
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
                fontSize: "12px",
              }}
            />
            <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
