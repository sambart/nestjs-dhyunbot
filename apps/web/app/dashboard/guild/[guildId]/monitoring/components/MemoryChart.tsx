"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import type { MetricPoint } from "@/app/lib/monitoring-api";
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
  heapUsedMb: {
    label: "사용 중 (MB)",
    color: "var(--chart-1)",
  },
  heapTotalMb: {
    label: "전체 (MB)",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

interface Props {
  data: MetricPoint[];
}

export default function MemoryChart({ data }: Props) {
  const chartData = data.map((d) => ({
    time: new Date(d.timestamp).toLocaleString("ko-KR", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    heapUsedMb: d.heapUsedMb,
    heapTotalMb: d.heapTotalMb,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>메모리 사용량</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="time"
              tickLine={false}
              axisLine={false}
              fontSize={12}
            />
            <YAxis tickLine={false} axisLine={false} unit="MB" />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Area
              type="monotone"
              dataKey="heapTotalMb"
              fill="var(--color-heapTotalMb)"
              stroke="var(--color-heapTotalMb)"
              fillOpacity={0.15}
            />
            <Area
              type="monotone"
              dataKey="heapUsedMb"
              fill="var(--color-heapUsedMb)"
              stroke="var(--color-heapUsedMb)"
              fillOpacity={0.4}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
