"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

import type { DailyTrendPoint } from "@/app/lib/co-presence-api";
import { formatMinutes, formatShortDate } from "@/app/lib/co-presence-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const chartConfig = {
  totalMinutes: {
    label: "동시접속 시간(분)",
    color: "#6366F1",
  },
} satisfies ChartConfig;

interface DailyTrendChartProps {
  data: DailyTrendPoint[];
}

export default function DailyTrendChart({ data }: DailyTrendChartProps) {
  const chartData = data.map((d) => ({
    date: formatShortDate(d.date),
    totalMinutes: d.totalMinutes,
  }));

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>일별 동시접속 추이</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center">
            <p className="text-sm text-muted-foreground">
              기간 내 동시접속 데이터가 없습니다.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>일별 동시접속 추이</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v}분`}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => [
                    formatMinutes(value as number),
                    "동시접속 시간",
                  ]}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="totalMinutes"
              stroke="#6366F1"
              fill="#6366F1"
              fillOpacity={0.1}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
