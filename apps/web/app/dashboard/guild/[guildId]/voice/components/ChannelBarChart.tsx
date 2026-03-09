"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { VoiceChannelStat } from "@/app/lib/voice-dashboard-api";

const chartConfig = {
  durationMin: {
    label: "체류(분)",
    color: "var(--chart-1)",
  },
  micOnMin: {
    label: "마이크 ON(분)",
    color: "var(--chart-2)",
  },
  micOffMin: {
    label: "마이크 OFF(분)",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

interface Props {
  data: VoiceChannelStat[];
}

export default function ChannelBarChart({ data }: Props) {
  const chartData = data.slice(0, 10).map((d) => ({
    name: d.channelName || d.channelId.slice(0, 8),
    durationMin: Math.round(d.totalDurationSec / 60),
    micOnMin: Math.round(d.micOnSec / 60),
    micOffMin: Math.round(d.micOffSec / 60),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>채널별 음성 활동 (Top 10)</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tickLine={false} axisLine={false} />
            <YAxis
              type="category"
              dataKey="name"
              tickLine={false}
              axisLine={false}
              width={100}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar
              dataKey="durationMin"
              fill="var(--color-durationMin)"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
