"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

import type { VoiceDailyTrend } from "@/app/lib/voice-dashboard-api";
import { formatDate } from "@/app/lib/voice-dashboard-api";
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
  channelDurationMin: {
    label: "체류 시간(분)",
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
  aloneMin: {
    label: "혼자(분)",
    color: "var(--chart-4)",
  },
} satisfies ChartConfig;

interface Props {
  data: VoiceDailyTrend[];
}

export default function DailyTrendChart({ data }: Props) {
  const chartData = data.map((d) => ({
    date: formatDate(d.date),
    channelDurationMin: Math.round(d.channelDurationSec / 60),
    micOnMin: Math.round(d.micOnSec / 60),
    micOffMin: Math.round(d.micOffSec / 60),
    aloneMin: Math.round(d.aloneSec / 60),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>일별 음성 활동 추이</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} interval="preserveStartEnd" />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Area
              type="monotone"
              dataKey="channelDurationMin"
              stackId="1"
              fill="var(--color-channelDurationMin)"
              stroke="var(--color-channelDurationMin)"
              fillOpacity={0.3}
            />
            <Area
              type="monotone"
              dataKey="micOnMin"
              stackId="2"
              fill="var(--color-micOnMin)"
              stroke="var(--color-micOnMin)"
              fillOpacity={0.3}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
