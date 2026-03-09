"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  computeCategoryStats,
  type VoiceChannelStat,
  type VoiceDailyRecord,
} from "@/app/lib/voice-dashboard-api";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

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
  records: VoiceDailyRecord[];
}

type TabValue = "channel" | "category";

const TAB_BASE =
  "rounded-md px-2 py-1 text-sm font-medium transition-colors";
const TAB_ACTIVE = "bg-background text-foreground shadow-sm";
const TAB_INACTIVE = "text-muted-foreground hover:text-foreground";

export default function ChannelBarChart({ data, records }: Props) {
  const [tab, setTab] = useState<TabValue>("channel");

  const channelChartData = data.slice(0, 10).map((d) => ({
    name: d.channelName || d.channelId.slice(0, 8),
    durationMin: Math.round(d.totalDurationSec / 60),
    micOnMin: Math.round(d.micOnSec / 60),
    micOffMin: Math.round(d.micOffSec / 60),
  }));

  const categoryChartData = computeCategoryStats(records)
    .slice(0, 10)
    .map((d) => ({
      name: d.categoryName,
      durationMin: Math.round(d.totalDurationSec / 60),
      micOnMin: Math.round(d.micOnSec / 60),
      micOffMin: Math.round(d.micOffSec / 60),
    }));

  const chartData = tab === "channel" ? channelChartData : categoryChartData;
  const chartHeight = Math.max(300, chartData.length * 40);

  return (
    <Card>
      <CardHeader>
        <CardTitle>음성 활동 (Top 10)</CardTitle>
        <CardAction>
          <div className="inline-flex items-center gap-0.5 rounded-lg bg-muted p-[3px]">
            <button
              type="button"
              className={cn(TAB_BASE, tab === "channel" ? TAB_ACTIVE : TAB_INACTIVE)}
              onClick={() => setTab("channel")}
            >
              채널별
            </button>
            <button
              type="button"
              className={cn(TAB_BASE, tab === "category" ? TAB_ACTIVE : TAB_INACTIVE)}
              onClick={() => setTab("category")}
            >
              카테고리별
            </button>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          style={{ height: chartHeight }}
          className="w-full"
        >
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tickLine={false} axisLine={false} />
            <YAxis
              type="category"
              dataKey="name"
              tickLine={false}
              axisLine={false}
              width={140}
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
