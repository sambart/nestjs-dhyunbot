"use client";

import { Clock, Mic, MicOff, UserX } from "lucide-react";

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
  const cards = [
    {
      title: "총 음성 시간",
      value: formatDuration(totalDurationSec),
      icon: Clock,
    },
    {
      title: "마이크 ON",
      value: formatDuration(totalMicOnSec),
      icon: Mic,
    },
    {
      title: "마이크 OFF",
      value: formatDuration(totalMicOffSec),
      icon: MicOff,
    },
    {
      title: "혼자 있는 시간",
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
