"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Cell, Pie, PieChart } from "recharts";

import type {
  VoiceCategoryStat,
  VoiceChannelStat,
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
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

const MAX_ITEMS = 6;
const UNCLASSIFIED_ID = "__unclassified__";

type TabValue = "channel" | "category";

const TAB_BASE =
  "rounded-md px-2 py-1 text-sm font-medium transition-colors";
const TAB_ACTIVE = "bg-background text-foreground shadow-sm";
const TAB_INACTIVE = "text-muted-foreground hover:text-foreground";

interface Props {
  channelStats: VoiceChannelStat[];
  categoryStats: VoiceCategoryStat[];
}

function toChartData(
  items: Array<{ id: string; label: string; totalDurationSec: number }>,
  etcLabel: string,
): Array<{ name: string; label: string; value: number }> {
  if (items.length <= MAX_ITEMS) {
    return items.map((item) => ({
      name: item.id,
      label: item.label,
      value: Math.round(item.totalDurationSec / 60),
    }));
  }
  const top = items.slice(0, MAX_ITEMS);
  const restTotal = items
    .slice(MAX_ITEMS)
    .reduce((sum, item) => sum + item.totalDurationSec, 0);
  return [
    ...top.map((item) => ({
      name: item.id,
      label: item.label,
      value: Math.round(item.totalDurationSec / 60),
    })),
    { name: "etc", label: etcLabel, value: Math.round(restTotal / 60) },
  ];
}

function PieChartPanel({
  chartData,
}: {
  chartData: Array<{ name: string; label: string; value: number }>;
}) {
  const chartConfig = chartData.reduce<ChartConfig>((acc, item, index) => {
    acc[item.label] = {
      label: item.label,
      color: CHART_COLORS[index % CHART_COLORS.length],
    };
    return acc;
  }, {});
  const colors = chartData.map(
    (_, i) => CHART_COLORS[i % CHART_COLORS.length],
  );

  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
        <ChartLegend content={<ChartLegendContent nameKey="label" />} />
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="label"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
        >
          {chartData.map((_, index) => (
            <Cell key={index} fill={colors[index]} />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}

export default function UserChannelPieChart({
  channelStats,
  categoryStats,
}: Props) {
  const t = useTranslations("dashboard");
  const [tab, setTab] = useState<TabValue>("channel");

  const etcLabel = t("voice.userDetail.channelPieChart.etc");

  const channelChartData = toChartData(
    channelStats.map((ch) => ({
      id: ch.channelId,
      label: ch.channelName,
      totalDurationSec: ch.totalDurationSec,
    })),
    etcLabel,
  );

  const categoryChartData = toChartData(
    categoryStats.map((cat) => ({
      id: cat.categoryId ?? UNCLASSIFIED_ID,
      label: cat.categoryName,
      totalDurationSec: cat.totalDurationSec,
    })),
    etcLabel,
  );

  const chartData = tab === "channel" ? channelChartData : categoryChartData;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("voice.userDetail.channelPieChart.title")}</CardTitle>
        <CardAction>
          <div className="inline-flex items-center gap-0.5 rounded-lg bg-muted p-[3px]">
            <button
              type="button"
              className={cn(TAB_BASE, tab === "channel" ? TAB_ACTIVE : TAB_INACTIVE)}
              onClick={() => setTab("channel")}
            >
              {t("voice.userDetail.channelPieChart.tabChannel")}
            </button>
            <button
              type="button"
              className={cn(TAB_BASE, tab === "category" ? TAB_ACTIVE : TAB_INACTIVE)}
              onClick={() => setTab("category")}
            >
              {t("voice.userDetail.channelPieChart.tabCategory")}
            </button>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        <PieChartPanel chartData={chartData} />
      </CardContent>
    </Card>
  );
}
