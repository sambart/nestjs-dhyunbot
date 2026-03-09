"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Mic, MicOff, User, Hash, UserX } from "lucide-react";
import type { VoiceSummary } from "@/app/lib/voice-dashboard-api";
import { formatDuration } from "@/app/lib/voice-dashboard-api";

interface Props {
  summary: VoiceSummary;
}

export default function SummaryCards({ summary }: Props) {
  const cards = [
    {
      title: "총 음성 시간",
      value: formatDuration(summary.totalDurationSec),
      icon: Clock,
    },
    {
      title: "마이크 ON",
      value: formatDuration(summary.totalMicOnSec),
      icon: Mic,
    },
    {
      title: "마이크 OFF",
      value: formatDuration(summary.totalMicOffSec),
      icon: MicOff,
    },
    {
      title: "혼자 있는 시간",
      value: formatDuration(summary.totalAloneSec),
      icon: UserX,
    },
    {
      title: "활성 유저",
      value: `${summary.uniqueUsers}명`,
      icon: User,
    },
    {
      title: "사용 채널",
      value: `${summary.uniqueChannels}개`,
      icon: Hash,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
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
