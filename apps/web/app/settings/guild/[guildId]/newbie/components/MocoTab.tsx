'use client';

import type { DiscordChannel } from '../../../../../lib/discord-api';
import type { NewbieConfig } from '../../../../../lib/newbie-api';

interface MocoTabProps {
  config: NewbieConfig;
  channels: DiscordChannel[];
  onChange: (partial: Partial<NewbieConfig>) => void;
}

export default function MocoTab({ config, channels, onChange }: MocoTabProps) {
  const isEnabled = config.mocoEnabled;

  return (
    <div className="space-y-6">
      {/* 기능 활성화 토글 */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">모코코 사냥 기능</p>
          <p className="text-xs text-gray-500 mt-0.5">
            기존 멤버가 신입과 함께 음성 채널에서 보낸 시간을 집계합니다.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isEnabled}
          onClick={() => onChange({ mocoEnabled: !isEnabled })}
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

      {/* 순위 표시 채널 */}
      <div>
        <label
          htmlFor="moco-rank-channel"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          순위 표시 채널
        </label>
        <select
          id="moco-rank-channel"
          value={config.mocoRankChannelId ?? ''}
          onChange={(e) =>
            onChange({ mocoRankChannelId: e.target.value || null })
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
          모코코 사냥 TOP N 순위 Embed를 표시할 채널
        </p>
        {channels.length === 0 && (
          <p className="text-xs text-amber-500 mt-1">
            채널 목록을 불러올 수 없습니다. 백엔드 연동 후 사용 가능합니다.
          </p>
        )}
      </div>

      {/* 자동 갱신 간격 (분) */}
      <div>
        <label
          htmlFor="moco-auto-refresh"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          자동 갱신 간격 (분)
        </label>
        <input
          id="moco-auto-refresh"
          type="number"
          min={1}
          max={1440}
          value={config.mocoAutoRefreshMinutes ?? ''}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            onChange({ mocoAutoRefreshMinutes: isNaN(val) ? null : val });
          }}
          disabled={!isEnabled}
          placeholder="예: 30"
          className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
        />
        <p className="text-xs text-gray-400 mt-1">
          순위 Embed를 자동으로 갱신하는 주기(분)
        </p>
      </div>
    </div>
  );
}
