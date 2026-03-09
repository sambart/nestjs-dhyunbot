"use client";

import { Cell, Pie, PieChart } from "recharts";

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
  micOn: {
    label: "마이크 ON",
    color: "var(--chart-2)",
  },
  micOff: {
    label: "마이크 OFF",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

interface Props {
  micOnSec: number;
  micOffSec: number;
}

export default function UserMicPieChart({ micOnSec, micOffSec }: Props) {
  const chartData = [
    { name: "micOn", value: Math.round(micOnSec / 60) },
    { name: "micOff", value: Math.round(micOffSec / 60) },
  ];

  const COLORS = ["var(--color-micOn)", "var(--color-micOff)"];

  return (
    <Card>
      <CardHeader>
        <CardTitle>마이크 ON/OFF 분포</CardTitle>
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
