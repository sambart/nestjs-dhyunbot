"use client";

import { BarChart2, TrendingDown, UserCheck, Users, UserX } from "lucide-react";

import type { InactiveMemberStats } from "@/app/lib/inactive-member-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  stats: InactiveMemberStats;
}

export default function StatsCards({ stats }: Props) {
  const cards = [
    {
      title: "활동 회원",
      value: `${stats.activeCount}명`,
      icon: UserCheck,
      valueClass: "text-green-600",
    },
    {
      title: "완전 비활동",
      value: `${stats.fullyInactiveCount}명`,
      icon: UserX,
      valueClass: "text-red-600",
    },
    {
      title: "저활동",
      value: `${stats.lowActiveCount}명`,
      icon: BarChart2,
      valueClass: "text-orange-600",
    },
    {
      title: "활동 감소",
      value: `${stats.decliningCount}명`,
      icon: TrendingDown,
      valueClass: "text-yellow-600",
    },
    {
      title: "전체 회원",
      value: `${stats.totalMembers}명`,
      icon: Users,
      valueClass: "",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${card.valueClass}`}>
              {card.value}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
