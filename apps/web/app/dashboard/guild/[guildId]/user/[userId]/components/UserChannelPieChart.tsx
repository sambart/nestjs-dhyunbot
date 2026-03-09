"use client";

import { Cell, Pie, PieChart } from "recharts";

import type { VoiceChannelStat } from "@/app/lib/voice-dashboard-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

const MAX_CHANNELS = 6;

interface Props {
  data: VoiceChannelStat[];
}

export default function UserChannelPieChart({ data }: Props) {
  // 상위 MAX_CHANNELS개 + 나머지는 "기타"로 묶기
  let chartData: Array<{ name: string; label: string; value: number }>;

  if (data.length <= MAX_CHANNELS) {
    chartData = data.map((ch) => ({
      name: ch.channelId,
      label: ch.channelName,
      value: Math.round(ch.totalDurationSec / 60),
    }));
  } else {
    const top = data.slice(0, MAX_CHANNELS);
    const rest = data.slice(MAX_CHANNELS);
    const restTotal = rest.reduce((sum, ch) => sum + ch.totalDurationSec, 0);
    chartData = [
      ...top.map((ch) => ({
        name: ch.channelId,
        label: ch.channelName,
        value: Math.round(ch.totalDurationSec / 60),
      })),
      {
        name: "etc",
        label: "기타",
        value: Math.round(restTotal / 60),
      },
    ];
  }

  const chartConfig = chartData.reduce<ChartConfig>((acc, item, index) => {
    acc[item.name] = {
      label: item.label,
      color: CHART_COLORS[index % CHART_COLORS.length],
    };
    return acc;
  }, {});

  const COLORS = chartData.map(
    (_, index) => CHART_COLORS[index % CHART_COLORS.length],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>채널별 활동 비율</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
            <ChartLegend content={<ChartLegendContent nameKey="name" />} />
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
