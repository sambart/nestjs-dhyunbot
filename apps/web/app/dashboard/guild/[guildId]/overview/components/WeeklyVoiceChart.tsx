"use client";

import { useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { formatShortDate } from "@/app/lib/overview-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

interface Props {
  data: Array<{ date: string; totalSec: number }>;
}

export default function WeeklyVoiceChart({ data }: Props) {
  const t = useTranslations("dashboard");

  const chartConfig = {
    durationMin: {
      label: t("overview.weeklyChart.durationMin"),
      color: "var(--chart-1)",
    },
  } satisfies ChartConfig;

  const chartData = data.map((d) => ({
    date: formatShortDate(d.date),
    durationMin: Math.round(d.totalSec / 60),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("overview.weeklyChart.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar
              dataKey="durationMin"
              fill="var(--color-durationMin)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
