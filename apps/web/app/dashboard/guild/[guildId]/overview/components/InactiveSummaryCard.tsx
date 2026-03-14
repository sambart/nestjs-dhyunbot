"use client";

import { UserX } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  grades: {
    fullyInactive: number;
    lowActive: number;
    declining: number;
  };
}

export default function InactiveSummaryCard({ grades }: Props) {
  const total =
    grades.fullyInactive + grades.lowActive + grades.declining;

  const items = [
    {
      label: "완전 비활동",
      count: grades.fullyInactive,
      color: "bg-red-500",
    },
    {
      label: "저활동",
      count: grades.lowActive,
      color: "bg-orange-500",
    },
    {
      label: "활동 감소",
      count: grades.declining,
      color: "bg-yellow-500",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserX className="h-5 w-5" />
          비활동 회원 요약
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <div key={item.label} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-medium">{item.count}명</span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-100">
              <div
                className={`h-2 rounded-full ${item.color}`}
                style={{
                  width:
                    total > 0 ? `${(item.count / total) * 100}%` : '0%',
                }}
              />
            </div>
          </div>
        ))}
        <div className="pt-2 border-t text-sm text-muted-foreground">
          총 {total}명
        </div>
      </CardContent>
    </Card>
  );
}
