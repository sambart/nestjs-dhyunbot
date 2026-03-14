"use client";

import { Clock, Headphones, PieChart, Users } from "lucide-react";

import {
  formatDurationSec,
  type OverviewData,
} from "@/app/lib/overview-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  data: OverviewData;
}

export default function OverviewSummaryCards({ data }: Props) {
  const inactiveRate = 100 - data.activeRate;

  const cards = [
    {
      title: "총 멤버 수",
      value: `${data.totalMemberCount}명`,
      icon: Users,
    },
    {
      title: "오늘 음성 활동",
      value: formatDurationSec(data.todayVoiceTotalSec),
      icon: Clock,
    },
    {
      title: "현재 음성 접속자",
      value: `${data.currentVoiceUserCount}명`,
      icon: Headphones,
    },
    {
      title: "활성/비활성 비율",
      value: (
        <>
          <span className="text-green-600">{data.activeRate}%</span>
          <span className="text-muted-foreground mx-1">/</span>
          <span className="text-red-600">{inactiveRate}%</span>
        </>
      ),
      icon: PieChart,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {card.value}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
