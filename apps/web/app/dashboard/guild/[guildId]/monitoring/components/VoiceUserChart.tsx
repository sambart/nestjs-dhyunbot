"use client";

import { useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

interface Props {
  data: Array<{ hour: number; avgUsers: number }>;
}

export default function VoiceUserChart({ data }: Props) {
  const t = useTranslations("dashboard");

  const chartConfig = {
    avgUsers: {
      label: t("monitoring.voiceUserChart.avgUsers"),
      color: "var(--chart-1)",
    },
  } satisfies ChartConfig;

  const maxVal = Math.max(...data.map((d) => d.avgUsers), 0);

  const chartData = data.map((d) => ({
    hour: t("monitoring.voiceUserChart.hourLabel", { hour: d.hour }),
    avgUsers: d.avgUsers,
    isPeak: d.avgUsers === maxVal && maxVal > 0,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("monitoring.voiceUserChart.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="hour"
              tickLine={false}
              axisLine={false}
              fontSize={12}
            />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="avgUsers" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={index}
                  fill={
                    entry.isPeak
                      ? "var(--chart-5)"
                      : "var(--color-avgUsers)"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
