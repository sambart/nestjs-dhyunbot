"use client";

import { ArrowLeftRight } from "lucide-react";
import Image from "next/image";

import type { PairUser, TopPair } from "@/app/lib/co-presence-api";
import { formatMinutes } from "@/app/lib/co-presence-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TopPairsPanelProps {
  topPairs: TopPair[];
}

interface UserAvatarProps {
  user: PairUser;
}

function UserAvatar({ user }: UserAvatarProps) {
  if (user.avatarUrl) {
    return (
      <Image
        src={user.avatarUrl}
        alt={user.userName}
        width={28}
        height={28}
        className="rounded-full flex-shrink-0"
      />
    );
  }
  return (
    <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
      <span className="text-indigo-600 text-xs font-semibold">
        {user.userName.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}

export default function TopPairsPanel({ topPairs }: TopPairsPanelProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>친밀도 TOP {topPairs.length}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {topPairs.length === 0 ? (
          <div className="flex items-center justify-center py-10 px-6">
            <p className="text-sm text-muted-foreground">
              기간 내 동시접속 데이터가 없습니다.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {topPairs.map((pair, index) => (
              <li
                key={`${pair.userA.userId}-${pair.userB.userId}-${index}`}
                className="flex flex-col gap-1.5 px-6 py-3"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <UserAvatar user={pair.userA} />
                  <span className="text-sm font-medium truncate max-w-[80px]">
                    {pair.userA.userName}
                  </span>
                  <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <UserAvatar user={pair.userB} />
                  <span className="text-sm font-medium truncate max-w-[80px]">
                    {pair.userB.userName}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatMinutes(pair.totalMinutes)} · {pair.sessionCount}세션
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
