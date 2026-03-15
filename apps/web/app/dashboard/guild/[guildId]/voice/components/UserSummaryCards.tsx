"use client";

import { Clock, Mic, MicOff, UserX } from "lucide-react";
import { useTranslations } from "next-intl";

import { formatDuration } from "@/app/lib/voice-dashboard-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  totalDurationSec: number;
  totalMicOnSec: number;
  totalMicOffSec: number;
  totalAloneSec: number;
}

export default function UserSummaryCards({
  totalDurationSec,
  totalMicOnSec,
  totalMicOffSec,
  totalAloneSec,
}: Props) {
  const t = useTranslations("dashboard");
  const cards = [
    {
      title: t("voice.summary.totalDuration"),
      value: formatDuration(totalDurationSec),
      icon: Clock,
    },
    {
      title: t("voice.summary.micOn"),
      value: formatDuration(totalMicOnSec),
      icon: Mic,
    },
    {
      title: t("voice.summary.micOff"),
      value: formatDuration(totalMicOffSec),
      icon: MicOff,
    },
    {
      title: t("voice.summary.alone"),
      value: formatDuration(totalAloneSec),
      icon: UserX,
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
            <div className="text-2xl font-bold">{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
