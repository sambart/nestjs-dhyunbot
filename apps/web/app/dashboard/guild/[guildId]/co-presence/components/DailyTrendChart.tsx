"use client";

import { useTranslations } from "next-intl";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

import type { DailyTrendPoint } from "@/app/lib/co-presence-api";
import { formatMinutes, formatShortDate } from "@/app/lib/co-presence-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

interface DailyTrendChartProps {
  data: DailyTrendPoint[];
}

export default function DailyTrendChart({ data }: DailyTrendChartProps) {
  const t = useTranslations("dashboard");

  const chartConfig = {
    totalMinutes: {
      label: t("coPresence.dailyTrend.label"),
      color: "#6366F1",
    },
  } satisfies ChartConfig;

  const chartData = data.map((d) => ({
    date: formatShortDate(d.date),
    totalMinutes: d.totalMinutes,
  }));

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("coPresence.dailyTrend.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center">
            <p className="text-sm text-muted-foreground">
              {t("coPresence.dailyTrend.noData")}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const minuteUnit = t("common.unit.minute");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("coPresence.dailyTrend.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v}${minuteUnit}`}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => [
                    formatMinutes(value as number),
                    t("coPresence.dailyTrend.tooltipLabel"),
                  ]}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="totalMinutes"
              stroke="#6366F1"
              fill="#6366F1"
              fillOpacity={0.1}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
