'use client';

import type { DiscordChannel } from '../../../../../lib/discord-api';
import type { NewbieConfig } from '../../../../../lib/newbie-api';

interface MissionTabProps {
  config: NewbieConfig;
  channels: DiscordChannel[];
  onChange: (partial: Partial<NewbieConfig>) => void;
}

export default function MissionTab({ config, channels, onChange }: MissionTabProps) {
  const isEnabled = config.missionEnabled;

  return (
    <div className="space-y-6">
      {/* 기능 활성화 토글 */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">미션 기능</p>
          <p className="text-xs text-gray-500 mt-0.5">
            신규 멤버에게 음성 채널 플레이타임 미션을 부여합니다.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isEnabled}
          onClick={() => onChange({ missionEnabled: !isEnabled })}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
            isEnabled ? 'bg-indigo-600' : 'bg-gray-200'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              isEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* 미션 기간 (일수) */}
      <div>
        <label
          htmlFor="mission-duration-days"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          미션 기간 (일)
        </label>
        <input
          id="mission-duration-days"
          type="number"
          min={1}
          max={365}
          value={config.missionDurationDays ?? ''}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            onChange({ missionDurationDays: isNaN(val) ? null : val });
          }}
          disabled={!isEnabled}
          placeholder="예: 7"
          className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
        />
        <p className="text-xs text-gray-400 mt-1">
          신규 멤버 가입 후 미션 기간(일수)
        </p>
      </div>

      {/* 목표 플레이타임 (시간) */}
      <div>
        <label
          htmlFor="mission-target-playtime"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          목표 플레이타임 (시간)
        </label>
        <input
          id="mission-target-playtime"
          type="number"
          min={1}
          max={9999}
          value={config.missionTargetPlaytimeHours ?? ''}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            onChange({ missionTargetPlaytimeHours: isNaN(val) ? null : val });
          }}
          disabled={!isEnabled}
          placeholder="예: 10"
          className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
        />
        <p className="text-xs text-gray-400 mt-1">
          미션 완료 기준 음성 채널 최소 플레이타임(시간)
        </p>
      </div>

      {/* 알림 채널 선택 */}
      <div>
        <label
          htmlFor="mission-notify-channel"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          미션 현황 알림 채널
        </label>
        <select
          id="mission-notify-channel"
          value={config.missionNotifyChannelId ?? ''}
          onChange={(e) =>
            onChange({ missionNotifyChannelId: e.target.value || null })
          }
          disabled={!isEnabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
        >
          <option value="">채널을 선택하세요</option>
          {channels.map((ch) => (
            <option key={ch.id} value={ch.id}>
              # {ch.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-400 mt-1">
          미션 현황 Embed 메시지를 표시할 채널
        </p>
        {channels.length === 0 && (
          <p className="text-xs text-amber-500 mt-1">
            채널 목록을 불러올 수 없습니다. 백엔드 연동 후 사용 가능합니다.
          </p>
        )}
      </div>
    </div>
  );
}
