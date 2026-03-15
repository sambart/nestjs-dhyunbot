"use client";

import { Target } from "lucide-react";
import { useTranslations } from "next-intl";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  mission: {
    inProgress: number;
    completed: number;
    failed: number;
  };
}

export default function MissionSummaryCard({ mission }: Props) {
  const t = useTranslations("dashboard");
  const items = [
    {
      label: t("overview.missionSummary.inProgress"),
      count: mission.inProgress,
      color: "text-blue-600",
      bg: "bg-blue-100",
    },
    {
      label: t("overview.missionSummary.completed"),
      count: mission.completed,
      color: "text-green-600",
      bg: "bg-green-100",
    },
    {
      label: t("overview.missionSummary.failed"),
      count: mission.failed,
      color: "text-red-600",
      bg: "bg-red-100",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          {t("overview.missionSummary.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-6">
          {items.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${item.bg} ${item.color}`}
              >
                {item.label}
              </span>
              <span className="text-lg font-bold">{item.count}{t("common.unit.person")}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
