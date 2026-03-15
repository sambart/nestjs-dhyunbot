"use client";

import { Activity, Clock, Cpu, Server, Users, Wifi } from "lucide-react";
import { useTranslations } from "next-intl";

import type { BotStatus } from "@/app/lib/monitoring-api";
import { formatUptime } from "@/app/lib/monitoring-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  status: BotStatus;
}

export default function StatusCards({ status }: Props) {
  const t = useTranslations("dashboard");

  const memPercent =
    status.memoryUsage.heapTotalMb > 0
      ? Math.round(
          (status.memoryUsage.heapUsedMb / status.memoryUsage.heapTotalMb) *
            100,
        )
      : 0;

  const pingColor =
    status.pingMs < 100
      ? "text-green-600"
      : status.pingMs < 200
        ? "text-yellow-600"
        : "text-red-600";

  const cards = [
    {
      title: t("monitoring.status.title"),
      value: status.online ? t("monitoring.status.online") : t("monitoring.status.offline"),
      icon: Activity,
      badge: status.online
        ? "bg-green-100 text-green-700"
        : "bg-red-100 text-red-700",
    },
    {
      title: t("monitoring.status.uptime"),
      value: formatUptime(status.uptimeMs),
      icon: Clock,
    },
    {
      title: t("monitoring.status.ping"),
      value: `${status.pingMs}ms`,
      icon: Wifi,
      valueClass: pingColor,
    },
    {
      title: t("monitoring.status.guildCount"),
      value: `${status.guildCount}${t("common.unit.server")}`,
      icon: Server,
    },
    {
      title: t("monitoring.status.memory"),
      value: `${status.memoryUsage.heapUsedMb}MB / ${status.memoryUsage.heapTotalMb}MB`,
      icon: Cpu,
      sub: `${memPercent}%`,
    },
    {
      title: t("monitoring.status.voiceUsers"),
      value: `${status.voiceUserCount}${t("common.unit.person")}`,
      icon: Users,
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
            {card.badge ? (
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-semibold ${card.badge}`}
              >
                <span
                  className={`mr-1.5 h-2 w-2 rounded-full ${status.online ? "bg-green-500" : "bg-red-500"}`}
                />
                {card.value}
              </span>
            ) : (
              <div
                className={`text-2xl font-bold ${card.valueClass ?? ""}`}
              >
                {card.value}
              </div>
            )}
            {card.sub && (
              <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
