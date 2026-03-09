"use client";

import { ArrowLeftRight, BarChart3, Mic, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Guild } from "./Header";

interface DashboardSidebarProps {
  guilds: Guild[];
  selectedGuildId: string;
}

export default function DashboardSidebar({
  guilds,
  selectedGuildId,
}: DashboardSidebarProps) {
  const pathname = usePathname();

  const selectedGuild = guilds.find((g) => g.id === selectedGuildId);

  const guildIconUrl = (guild: Guild) =>
    guild.icon
      ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=64`
      : null;

  const menuItems = [
    {
      href: `/dashboard/guild/${selectedGuildId}/voice`,
      label: "음성 활동",
      icon: Mic,
    },
  ];

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-4rem)]">
      <div className="p-4">
        {/* 선택된 길드 표시 */}
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            서버
          </h2>
          <div className="flex items-center space-x-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
            {selectedGuild && guildIconUrl(selectedGuild) ? (
              <img
                src={guildIconUrl(selectedGuild)!}
                alt={selectedGuild.name}
                width={20}
                height={20}
                className="rounded-full flex-shrink-0"
              />
            ) : (
              <div className="w-5 h-5 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-indigo-600 text-[10px] font-semibold">
                  {selectedGuild?.name?.charAt(0) ?? "?"}
                </span>
              </div>
            )}
            <span className="text-sm text-gray-900 truncate flex-1">
              {selectedGuild?.name ?? "Unknown"}
            </span>
          </div>
          {guilds.length > 1 && (
            <Link
              href="/select-guild?mode=dashboard"
              className="flex items-center space-x-2 mt-2 px-3 py-1.5 text-xs text-gray-500 hover:text-indigo-600 hover:bg-gray-50 rounded transition-colors"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>서버 변경</span>
            </Link>
          )}
        </div>

        {/* 대시보드 메뉴 */}
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          대시보드
        </h2>
        <nav className="space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700 font-medium"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* 설정으로 이동 */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <Link
            href={`/settings/guild/${selectedGuildId}`}
            className="flex items-center space-x-3 px-3 py-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <Settings className="w-5 h-5" />
            <span>설정으로 이동</span>
          </Link>
        </div>
      </div>
    </aside>
  );
}
