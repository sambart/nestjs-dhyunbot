"use client";

import { useTranslations } from "next-intl";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import type { MetricPoint } from "@/app/lib/monitoring-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

interface Props {
  data: MetricPoint[];
}

export default function PingChart({ data }: Props) {
  const t = useTranslations("dashboard");

  const chartConfig = {
    pingMs: {
      label: t("monitoring.pingChart.label"),
      color: "var(--chart-1)",
    },
  } satisfies ChartConfig;

  const chartData = data.map((d) => ({
    time: new Date(d.timestamp).toLocaleString("ko-KR", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    pingMs: d.pingMs,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("monitoring.pingChart.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="time"
              tickLine={false}
              axisLine={false}
              fontSize={12}
            />
            <YAxis tickLine={false} axisLine={false} unit="ms" />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ReferenceLine
              y={200}
              stroke="var(--destructive)"
              strokeDasharray="4 4"
              label={{ value: "200ms", position: "right", fontSize: 11 }}
            />
            <Line
              type="monotone"
              dataKey="pingMs"
              stroke="var(--color-pingMs)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
