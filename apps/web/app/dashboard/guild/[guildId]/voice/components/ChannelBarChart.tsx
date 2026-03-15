"use client";

import { useTranslations } from "next-intl";
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
  const t = useTranslations("dashboard");

  const chartConfig = {
    durationMin: {
      label: t("voice.channelChart.durationMin"),
      color: "var(--chart-1)",
    },
    micOnMin: {
      label: t("voice.channelChart.micOnMin"),
      color: "var(--chart-2)",
    },
    micOffMin: {
      label: t("voice.channelChart.micOffMin"),
      color: "var(--chart-3)",
    },
  } satisfies ChartConfig;

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
        <CardTitle>{t("voice.channelChart.title")}</CardTitle>
        <CardAction>
          <div className="inline-flex items-center gap-0.5 rounded-lg bg-muted p-[3px]">
            <button
              type="button"
              className={cn(TAB_BASE, tab === "channel" ? TAB_ACTIVE : TAB_INACTIVE)}
              onClick={() => setTab("channel")}
            >
              {t("voice.channelChart.tabChannel")}
            </button>
            <button
              type="button"
              className={cn(TAB_BASE, tab === "category" ? TAB_ACTIVE : TAB_INACTIVE)}
              onClick={() => setTab("category")}
            >
              {t("voice.channelChart.tabCategory")}
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
              width={100}
              tick={{ fontSize: 12 }}
              tickFormatter={(value: string) => value.length > 8 ? `${value.slice(0, 8)}…` : value}
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
