'use client';

import type { MocoRankItem } from '../../../../../lib/newbie-dashboard-api';

interface MemberProfile {
  userName: string;
  avatarUrl: string | null;
}

interface MocoTopCardsProps {
  items: MocoRankItem[];
  profiles: Record<string, MemberProfile>;
  total: number;
}

const RANK_STYLES = [
  {
    border: 'border-yellow-400',
    bg: 'bg-yellow-50',
    badge: 'bg-yellow-400 text-white',
    label: '1위',
    size: 'text-lg',
    ring: 'ring-2 ring-yellow-400',
  },
  {
    border: 'border-gray-400',
    bg: 'bg-gray-50',
    badge: 'bg-gray-400 text-white',
    label: '2위',
    size: 'text-base',
    ring: 'ring-2 ring-gray-300',
  },
  {
    border: 'border-amber-600',
    bg: 'bg-amber-50',
    badge: 'bg-amber-600 text-white',
    label: '3위',
    size: 'text-base',
    ring: 'ring-2 ring-amber-400',
  },
] as const;

const AVATAR_PLACEHOLDER = 'https://cdn.discordapp.com/embed/avatars/0.png';

function TopCard({
  rank,
  item,
  profile,
}: {
  rank: number;
  item: MocoRankItem;
  profile: MemberProfile | undefined;
}) {
  const style = RANK_STYLES[rank - 1];
  if (!style) return null;

  const avatarUrl = profile?.avatarUrl ?? AVATAR_PLACEHOLDER;
  const userName = profile?.userName ?? item.hunterId;

  return (
    <div
      className={`flex flex-col items-center gap-2 rounded-xl border-2 ${style.border} ${style.bg} p-4 text-center`}
    >
      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${style.badge}`}>
        {style.label}
      </span>
      <img
        src={avatarUrl}
        alt={userName}
        width={56}
        height={56}
        className={`rounded-full ${style.ring}`}
      />
      <span className={`font-semibold text-gray-900 ${style.size} max-w-[120px] truncate`}>
        {userName}
      </span>
      <div className="text-sm text-gray-600">
        <span className="font-bold text-indigo-700">{item.score.toLocaleString()}점</span>
      </div>
      <div className="flex gap-3 text-xs text-gray-500">
        <span>사냥 {item.channelMinutes}분</span>
        <span>세션 {item.sessionCount}회</span>
        <span>모코코 {item.uniqueNewbieCount}명</span>
      </div>
    </div>
  );
}

export default function MocoTopCards({ items, profiles, total }: MocoTopCardsProps) {
  const topItems = items.slice(0, 3);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">상위 사냥꾼</h3>
        <span className="text-sm text-gray-500">총 {total}명 참여</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {topItems.map((item, idx) => (
          <TopCard
            key={item.hunterId}
            rank={idx + 1}
            item={item}
            profile={profiles[item.hunterId]}
          />
        ))}
      </div>
    </div>
  );
}
