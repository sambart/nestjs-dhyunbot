"use client";

import { LogIn } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { Guild } from "../../../components/Header";
import DashboardSidebar from "../../../components/DashboardSidebar";

export default function DashboardGuildLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const router = useRouter();
  const guildId = params.guildId as string;

  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    fetch("/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setIsLoggedIn(true);
          const userGuilds: Guild[] = data.user.guilds ?? [];
          setGuilds(userGuilds);
          if (!userGuilds.some((g) => g.id === guildId)) {
            router.replace("/select-guild?mode=dashboard");
          }
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [guildId, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)]">
        <div className="w-64 bg-white border-r border-gray-200 animate-pulse" />
        <main className="flex-1 p-8 bg-gray-50" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] bg-gray-50">
        <div className="text-center">
          <LogIn className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            로그인이 필요합니다
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            대시보드를 보려면 Discord 계정으로 로그인하세요.
          </p>
          <a
            href="/auth/discord"
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium inline-block"
          >
            로그인
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex">
      <DashboardSidebar guilds={guilds} selectedGuildId={guildId} />
      <main className="flex-1 bg-gray-50 overflow-auto">
        {children}
      </main>
    </div>
  );
}
