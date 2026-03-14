"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { formatShortDate } from "@/app/lib/overview-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const chartConfig = {
  durationMin: {
    label: "음성 시간(분)",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

interface Props {
  data: Array<{ date: string; totalSec: number }>;
}

export default function WeeklyVoiceChart({ data }: Props) {
  const chartData = data.map((d) => ({
    date: formatShortDate(d.date),
    durationMin: Math.round(d.totalSec / 60),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>최근 7일 음성 활동</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} />
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
