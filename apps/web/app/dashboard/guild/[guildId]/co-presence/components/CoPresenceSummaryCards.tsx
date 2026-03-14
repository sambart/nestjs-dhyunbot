"use client";

import { BarChart3, Clock, Link2, Users } from "lucide-react";

import type { CoPresenceSummary } from "@/app/lib/co-presence-api";
import { formatMinutes } from "@/app/lib/co-presence-api";
import { Card, CardContent } from "@/components/ui/card";

interface CoPresenceSummaryCardsProps {
  summary: CoPresenceSummary;
}

export default function CoPresenceSummaryCards({
  summary,
}: CoPresenceSummaryCardsProps) {
  const cards = [
    {
      label: "활성 멤버",
      value: `${summary.activeMemberCount}명`,
      icon: Users,
    },
    {
      label: "총 관계 수",
      value: `${summary.totalPairCount}쌍`,
      icon: Link2,
    },
    {
      label: "총 동시접속 시간",
      value: formatMinutes(summary.totalCoPresenceMinutes),
      icon: Clock,
    },
    {
      label: "평균 관계 수/인",
      value: `${summary.avgPairsPerMember.toFixed(1)}개`,
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
