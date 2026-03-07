'use client';

import type { DiscordChannel } from '../../../../../lib/discord-api';
import type { NewbieConfig } from '../../../../../lib/newbie-api';
import EmbedPreview from './EmbedPreview';

const MISSION_TEMPLATE_VARIABLES = [
  { variable: '{count}', description: '현재 진행중인 미션 총 인원 수' },
] as const;

const SAMPLE_DESCRIPTION =
  '🧑‍🌾 뉴비 멤버 (총 인원: 3명)\n\n@사용자1 🌱\n3월 1일 ~ 3월 8일\n🟡 진행중 | 플레이타임: 2시간 30분 0초 | 플레이횟수: 5회\n\n@사용자2 🌱\n3월 3일 ~ 3월 10일\n✅ 완료 | 플레이타임: 12시간 0분 0초 | 플레이횟수: 8회';

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

      {/* Embed 제목 */}
      <div>
        <label
          htmlFor="mission-embed-title"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Embed 제목
        </label>
        <input
          id="mission-embed-title"
          type="text"
          value={config.missionEmbedTitle ?? ''}
          onChange={(e) =>
            onChange({ missionEmbedTitle: e.target.value || null })
          }
          disabled={!isEnabled}
          placeholder="예: 🧑‍🌾 신입 미션 체크"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
        />
        <p className="text-xs text-gray-400 mt-1">
          비워두면 기본값: 🧑‍🌾 신입 미션 체크
        </p>
      </div>

      {/* Embed 색상 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Embed 색상
        </label>
        <div className="flex items-center space-x-3">
          <input
            type="color"
            value={config.missionEmbedColor ?? '#57F287'}
            onChange={(e) => onChange({ missionEmbedColor: e.target.value })}
            disabled={!isEnabled}
            aria-label="Embed 색상 피커"
            className="h-9 w-16 border border-gray-300 rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed p-1"
          />
          <input
            type="text"
            value={config.missionEmbedColor ?? '#57F287'}
            onChange={(e) => {
              const val = e.target.value;
              if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                onChange({ missionEmbedColor: val });
              }
            }}
            disabled={!isEnabled}
            maxLength={7}
            placeholder="#57F287"
            aria-label="Embed 색상 HEX 코드"
            className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
          />
        </div>
      </div>

      {/* 썸네일 이미지 URL */}
      <div>
        <label
          htmlFor="mission-thumbnail-url"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          썸네일 이미지 URL
        </label>
        <input
          id="mission-thumbnail-url"
          type="url"
          value={config.missionEmbedThumbnailUrl ?? ''}
          onChange={(e) =>
            onChange({ missionEmbedThumbnailUrl: e.target.value || null })
          }
          disabled={!isEnabled}
          placeholder="https://example.com/image.png"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
        />
      </div>

      {/* 템플릿 변수 안내 */}
      <div className="bg-indigo-50 rounded-lg p-4">
        <p className="text-xs font-semibold text-indigo-700 mb-2">
          사용 가능한 템플릿 변수
        </p>
        <dl className="space-y-1.5">
          {MISSION_TEMPLATE_VARIABLES.map((item) => (
            <div key={item.variable} className="flex items-center space-x-2">
              <code className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-mono">
                {item.variable}
              </code>
              <span className="text-xs text-indigo-600">{item.description}</span>
            </div>
          ))}
        </dl>
        <p className="text-xs text-indigo-500 mt-3">
          설명(Description)은 미션 데이터에서 자동 생성됩니다.
        </p>
      </div>

      {/* Embed 미리보기 */}
      <EmbedPreview
        title={
          (config.missionEmbedTitle ?? '🧑‍🌾 신입 미션 체크')
            .replace(/\{count\}/g, '3')
        }
        description={SAMPLE_DESCRIPTION}
        color={config.missionEmbedColor}
        thumbnailUrl={config.missionEmbedThumbnailUrl}
      />
    </div>
  );
}
