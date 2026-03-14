"use client";

import type { IsolatedMember } from "@/app/lib/co-presence-api";
import { formatMinutes } from "@/app/lib/co-presence-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface IsolatedMemberListProps {
  members: IsolatedMember[];
}

export default function IsolatedMemberList({
  members,
}: IsolatedMemberListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>고립 멤버</CardTitle>
        <p className="text-sm text-muted-foreground">
          음성 채널에 접속했지만 기간 내 단 한 번도 다른 멤버와 동시에 있지
          않은 멤버입니다.
        </p>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-muted-foreground">
              고립 멤버가 없습니다.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-3 text-left font-medium text-muted-foreground">
                    사용자명
                  </th>
                  <th className="pb-3 text-right font-medium text-muted-foreground">
                    총 음성 시간
                  </th>
                  <th className="pb-3 text-right font-medium text-muted-foreground">
                    마지막 접속일
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {members.map((member) => (
                  <tr key={member.userId} className="hover:bg-muted/50">
                    <td className="py-3 font-medium">{member.userName}</td>
                    <td className="py-3 text-right text-muted-foreground">
                      {formatMinutes(member.totalVoiceMinutes)}
                    </td>
                    <td className="py-3 text-right text-muted-foreground">
                      {member.lastVoiceDate}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
