"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import type { VoiceDailyTrend } from "@/app/lib/voice-dashboard-api";
import { formatDate } from "@/app/lib/voice-dashboard-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const chartConfig = {
  channelDurationMin: {
    label: "체류 시간(분)",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

interface Props {
  data: VoiceDailyTrend[];
}

export default function UserDailyBarChart({ data }: Props) {
  const chartData = data.map((d) => ({
    date: formatDate(d.date),
    channelDurationMin: Math.round(d.channelDurationSec / 60),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>일별 음성 활동</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar
              dataKey="channelDurationMin"
              fill="var(--color-channelDurationMin)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
