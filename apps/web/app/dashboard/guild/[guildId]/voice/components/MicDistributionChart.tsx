"use client";

import { Cell, Pie, PieChart } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { VoiceSummary } from "@/app/lib/voice-dashboard-api";

const chartConfig = {
  micOn: {
    label: "마이크 ON",
    color: "var(--chart-2)",
  },
  micOff: {
    label: "마이크 OFF",
    color: "var(--chart-3)",
  },
  alone: {
    label: "혼자",
    color: "var(--chart-4)",
  },
} satisfies ChartConfig;

interface Props {
  summary: VoiceSummary;
}

export default function MicDistributionChart({ summary }: Props) {
  const chartData = [
    {
      name: "micOn",
      value: Math.round(summary.totalMicOnSec / 60),
    },
    {
      name: "micOff",
      value: Math.round(summary.totalMicOffSec / 60),
    },
    {
      name: "alone",
      value: Math.round(summary.totalAloneSec / 60),
    },
  ];

  const COLORS = [
    "var(--color-micOn)",
    "var(--color-micOff)",
    "var(--color-alone)",
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>음성 활동 분포</CardTitle>
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
              cy="50%"
              innerRadius={60}
              outerRadius={100}
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
