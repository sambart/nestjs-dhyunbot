"use client";

import { BarChart3, Clock, Link2, Users } from "lucide-react";
import { useTranslations } from "next-intl";

import { formatMinutesI18n } from "@/app/lib/format-utils";
import type { CoPresenceSummary } from "@/app/lib/co-presence-api";
import { Card, CardContent } from "@/components/ui/card";

interface CoPresenceSummaryCardsProps {
  summary: CoPresenceSummary;
}

export default function CoPresenceSummaryCards({
  summary,
}: CoPresenceSummaryCardsProps) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");

  const cards = [
    {
      label: t("coPresence.summary.activeMembers"),
      value: `${summary.activeMemberCount}${t("common.unit.person")}`,
      icon: Users,
    },
    {
      label: t("coPresence.summary.totalPairs"),
      value: `${summary.totalPairCount}${t("common.unit.pair")}`,
      icon: Link2,
    },
    {
      label: t("coPresence.summary.totalTime"),
      value: formatMinutesI18n(summary.totalCoPresenceMinutes, tc),
      icon: Clock,
    },
    {
      label: t("coPresence.summary.avgPairs"),
      value: `${summary.avgPairsPerMember.toFixed(1)}${t("common.unit.channel")}`,
      icon: BarChart3,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-lg bg-indigo-50 p-3">
              <card.icon className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <p className="text-2xl font-bold">{card.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
