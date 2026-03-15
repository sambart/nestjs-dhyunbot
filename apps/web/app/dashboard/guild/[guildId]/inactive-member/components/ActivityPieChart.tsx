"use client";

import { Cell, Pie, PieChart } from "recharts";

import type { InactiveMemberStats } from "@/app/lib/inactive-member-api";
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
  active: {
    label: "활동",
    color: "var(--chart-1)",
  },
  fullyInactive: {
    label: "완전 비활동",
    color: "var(--chart-2)",
  },
  lowActive: {
    label: "저활동",
    color: "var(--chart-3)",
  },
  declining: {
    label: "활동 감소",
    color: "var(--chart-4)",
  },
} satisfies ChartConfig;

interface Props {
  stats: InactiveMemberStats;
}

export default function ActivityPieChart({ stats }: Props) {
  const chartData = [
    { name: "active", value: stats.activeCount },
    { name: "fullyInactive", value: stats.fullyInactiveCount },
    { name: "lowActive", value: stats.lowActiveCount },
    { name: "declining", value: stats.decliningCount },
  ];

  const COLORS = [
    "var(--color-active)",
    "var(--color-fullyInactive)",
    "var(--color-lowActive)",
    "var(--color-declining)",
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>활동 비율</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="45%"
              innerRadius="40%"
              outerRadius="65%"
              paddingAngle={2}
            >
              {chartData.map((_, index) => (
                <Cell key={index} fill={COLORS[index]} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
