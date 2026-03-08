'use client';

import type { ReactNode } from 'react';

import type { DiscordChannel } from '../../../../../lib/discord-api';

interface EmbedPreviewProps {
  title: string | null;
  description: string | null;
  color: string | null;
  thumbnailUrl: string | null;
  channels?: DiscordChannel[];
}

function renderDescription(
  text: string,
  channels: DiscordChannel[],
): ReactNode {
  const channelMap = new Map(channels.map((ch) => [ch.id, ch]));
  const parts = text.split(/(<#\d+>)/g);

  return parts.map((part, i) => {
    const match = part.match(/^<#(\d+)>$/);
    if (match) {
      const channel = channelMap.get(match[1]);
      return (
        <span
          key={i}
          className="inline-flex items-center bg-[#404675] text-[#c9cdfb] rounded px-1 py-0.5 text-xs font-medium"
        >
          <span className="mr-0.5">#</span>
          {channel?.name ?? match[1]}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export default function EmbedPreview({
  title,
  description,
  color,
  thumbnailUrl,
  channels = [],
}: EmbedPreviewProps) {
  const borderColor = color ?? '#5865F2';
  const displayTitle = title || '(제목 없음)';

  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-2">미리보기</p>
      <div className="bg-[#2B2D31] rounded-lg p-4">
        <div
          className="bg-[#313338] rounded-md overflow-hidden flex"
          style={{ borderLeft: `4px solid ${borderColor}` }}
        >
          <div className="flex-1 p-4 min-w-0">
            <p className="text-white font-semibold text-sm mb-1 break-words">
              {displayTitle}
            </p>
            <p className="text-gray-300 text-xs whitespace-pre-wrap break-words">
              {description
                ? renderDescription(description, channels)
                : '(설명 없음)'}
            </p>
          </div>
          {thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnailUrl}
              alt="썸네일"
              className="w-16 h-16 object-cover m-4 rounded flex-shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
