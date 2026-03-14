"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import type { InactiveTrendPoint } from "@/app/lib/inactive-member-api";
import { formatTrendDate } from "@/app/lib/inactive-member-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const chartConfig = {
  fullyInactive: {
    label: "완전 비활동",
    color: "var(--chart-1)",
  },
  lowActive: {
    label: "저활동",
    color: "var(--chart-2)",
  },
  declining: {
    label: "활동 감소",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

interface Props {
  trend: InactiveTrendPoint[];
}

export default function InactiveTrendChart({ trend }: Props) {
  const chartData = trend.map((point) => ({
    date: formatTrendDate(point.date),
    fullyInactive: point.fullyInactive,
    lowActive: point.lowActive,
    declining: point.declining,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>비활동 회원 추이</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Line
              type="monotone"
              dataKey="fullyInactive"
              stroke="var(--color-fullyInactive)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="lowActive"
              stroke="var(--color-lowActive)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="declining"
              stroke="var(--color-declining)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
