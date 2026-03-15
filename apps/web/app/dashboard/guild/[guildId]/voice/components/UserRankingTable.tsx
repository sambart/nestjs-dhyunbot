"use client";

import { useTranslations } from "next-intl";

import { formatDurationSecI18n } from "@/app/lib/format-utils";
import type { VoiceUserStat } from "@/app/lib/voice-dashboard-api";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import UserSearchDropdown from "./UserSearchDropdown";

interface Props {
  data: VoiceUserStat[];
  guildId: string;
  profiles?: Record<string, { userName: string; avatarUrl: string | null }>;
  onUserSelect: (userId: string) => void;
}

export default function UserRankingTable({
  data,
  guildId,
  profiles,
  onUserSelect,
}: Props) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const top20 = data.slice(0, 20);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("voice.userRanking.title")}</CardTitle>
        <CardAction>
          <UserSearchDropdown guildId={guildId} onSelect={onUserSelect} />
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="grid grid-cols-6 gap-2 text-sm font-medium text-muted-foreground border-b pb-2">
            <span>{t("voice.userRanking.rank")}</span>
            <span className="col-span-2">{t("voice.userRanking.user")}</span>
            <span>{t("voice.userRanking.duration")}</span>
            <span>{t("voice.userRanking.micOn")}</span>
            <span>{t("voice.userRanking.alone")}</span>
          </div>
          {top20.map((user, index) => {
            const profile = profiles?.[user.userId];
            const avatarUrl = profile?.avatarUrl;
            const displayName = profile?.userName ?? user.userName;

            return (
              <div
                key={user.userId}
                className="grid grid-cols-6 gap-2 items-center text-sm py-1 cursor-pointer hover:bg-muted/50 rounded-sm transition-colors"
                onClick={() => onUserSelect(user.userId)}
              >
                <span>
                  {index < 3 ? (
                    <Badge variant={index === 0 ? "default" : "secondary"}>
                      {index + 1}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground pl-2">
                      {index + 1}
                    </span>
                  )}
                </span>
                <span className="col-span-2 flex items-center gap-2 font-medium truncate">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      className="h-6 w-6 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-semibold flex-shrink-0">
                      {displayName.charAt(0)}
                    </div>
                  )}
                  <span className="truncate">{displayName}</span>
                </span>
                <span>{formatDurationSecI18n(user.totalDurationSec, tc)}</span>
                <span>{formatDurationSecI18n(user.micOnSec, tc)}</span>
                <span className="text-muted-foreground">
                  {formatDurationSecI18n(user.aloneSec, tc)}
                </span>
              </div>
            );
          })}
          {top20.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              {t("voice.userRanking.noData")}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
