"use client";

import { useTranslations } from "next-intl";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import type { MetricPoint } from "@/app/lib/monitoring-api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

interface Props {
  data: MetricPoint[];
  availabilityPercent: number;
}

export default function UptimeChart({ data, availabilityPercent }: Props) {
  const t = useTranslations("dashboard");

  const chartConfig = {
    status: {
      label: t("monitoring.uptimeChart.statusLabel"),
      color: "var(--chart-2)",
    },
  } satisfies ChartConfig;

  const chartData = data.map((d) => ({
    time: new Date(d.timestamp).toLocaleString("ko-KR", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    status: d.online ? 1 : 0,
  }));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t("monitoring.uptimeChart.title")}</CardTitle>
          <CardDescription className="text-right">
            <span className="text-lg font-semibold text-foreground">
              {availabilityPercent}%
            </span>{" "}
            {t("monitoring.uptimeChart.availability")}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="time"
              tickLine={false}
              axisLine={false}
              fontSize={12}
            />
            <YAxis
              domain={[0, 1]}
              ticks={[0, 1]}
              tickFormatter={(v) => (v === 1 ? t("monitoring.uptimeChart.on") : t("monitoring.uptimeChart.off"))}
              tickLine={false}
              axisLine={false}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) =>
                    value === 1 ? t("monitoring.uptimeChart.online") : t("monitoring.uptimeChart.offline")
                  }
                />
              }
            />
            <Area
              type="stepAfter"
              dataKey="status"
              fill="var(--color-status)"
              stroke="var(--color-status)"
              fillOpacity={0.4}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
