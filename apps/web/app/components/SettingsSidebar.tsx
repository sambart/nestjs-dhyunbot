"use client";

import { ArrowLeftRight, BarChart3, Mic, Pin, Radio, Settings, Tag, Users, UserX } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Guild } from "./Header";

interface SettingsSidebarProps {
  guilds: Guild[];
  selectedGuildId: string;
}

export default function SettingsSidebar({
  guilds,
  selectedGuildId,
}: SettingsSidebarProps) {
  const pathname = usePathname();

  const selectedGuild = guilds.find((g) => g.id === selectedGuildId);

  const guildIconUrl = (guild: Guild) =>
    guild.icon
      ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=64`
      : null;

  const menuItems = [
    { href: `/settings/guild/${selectedGuildId}`, label: "일반 설정", icon: Settings },
    { href: `/settings/guild/${selectedGuildId}/auto-channel`, label: "자동방 설정", icon: Radio },
    { href: `/settings/guild/${selectedGuildId}/newbie`, label: "신입 관리", icon: Users },
    { href: `/settings/guild/${selectedGuildId}/status-prefix`, label: "게임방 상태 설정", icon: Tag },
    { href: `/settings/guild/${selectedGuildId}/sticky-message`, label: "고정메세지", icon: Pin },
    { href: `/settings/guild/${selectedGuildId}/voice`, label: "음성 설정", icon: Mic },
    { href: `/settings/guild/${selectedGuildId}/inactive-member`, label: "비활동 회원 설정", icon: UserX },
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
              href="/select-guild"
              className="flex items-center space-x-2 mt-2 px-3 py-1.5 text-xs text-gray-500 hover:text-indigo-600 hover:bg-gray-50 rounded transition-colors"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>서버 변경</span>
            </Link>
          )}
        </div>

        {/* 설정 메뉴 */}
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          설정
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

        {/* 대시보드로 이동 */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <Link
            href={`/dashboard/guild/${selectedGuildId}/voice`}
            className="flex items-center space-x-3 px-3 py-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <BarChart3 className="w-5 h-5" />
            <span>대시보드로 이동</span>
          </Link>
        </div>
      </div>
    </aside>
  );
}
