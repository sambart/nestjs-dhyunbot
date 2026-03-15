"use client";

import { BarChart2, TrendingDown, UserCheck, Users, UserX } from "lucide-react";
import { useTranslations } from "next-intl";

import type { InactiveMemberStats } from "@/app/lib/inactive-member-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  stats: InactiveMemberStats;
}

export default function StatsCards({ stats }: Props) {
  const t = useTranslations("dashboard");

  const cards = [
    {
      title: t("inactive.statsCards.active"),
      value: `${stats.activeCount}${t("common.unit.person")}`,
      icon: UserCheck,
      valueClass: "text-green-600",
    },
    {
      title: t("inactive.statsCards.fullyInactive"),
      value: `${stats.fullyInactiveCount}${t("common.unit.person")}`,
      icon: UserX,
      valueClass: "text-red-600",
    },
    {
      title: t("inactive.statsCards.lowActive"),
      value: `${stats.lowActiveCount}${t("common.unit.person")}`,
      icon: BarChart2,
      valueClass: "text-orange-600",
    },
    {
      title: t("inactive.statsCards.declining"),
      value: `${stats.decliningCount}${t("common.unit.person")}`,
      icon: TrendingDown,
      valueClass: "text-yellow-600",
    },
    {
      title: t("inactive.statsCards.total"),
      value: `${stats.totalMembers}${t("common.unit.person")}`,
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
