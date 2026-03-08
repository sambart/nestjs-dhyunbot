'use client';

import type { DiscordChannel, DiscordEmoji } from '../../../../../lib/discord-api';
import type { MissionTemplate, NewbieConfig } from '../../../../../lib/newbie-api';
import MissionTemplateSection from './MissionTemplateSection';

interface MissionTabProps {
  config: NewbieConfig;
  channels: DiscordChannel[];
  emojis: DiscordEmoji[];
  onChange: (partial: Partial<NewbieConfig>) => void;
  missionTemplate: MissionTemplate;
  onMissionTemplateChange: (template: MissionTemplate) => void;
  onSaveMissionTemplate: () => void;
  isSavingMissionTemplate: boolean;
  missionTemplateSaveError: string | null;
  missionTemplateSaveSuccess: boolean;
}

export default function MissionTab({
  config,
  channels,
  onChange,
  missionTemplate,
  onMissionTemplateChange,
  onSaveMissionTemplate,
  isSavingMissionTemplate,
  missionTemplateSaveError,
  missionTemplateSaveSuccess,
}: MissionTabProps) {
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

      {/* 플레이횟수 최소 참여시간 */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <input
            id="play-count-min-duration-enabled"
            type="checkbox"
            checked={config.playCountMinDurationMin !== null}
            onChange={(e) => {
              if (e.target.checked) {
                onChange({ playCountMinDurationMin: 30 });
              } else {
                onChange({ playCountMinDurationMin: null });
              }
            }}
            disabled={!isEnabled}
            className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 disabled:cursor-not-allowed"
          />
          <label
            htmlFor="play-count-min-duration-enabled"
            className="text-sm font-medium text-gray-700"
          >
            플레이횟수 최소 참여시간 (분)
          </label>
        </div>
        <input
          id="play-count-min-duration"
          type="number"
          min={1}
          max={9999}
          value={config.playCountMinDurationMin ?? 30}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            onChange({ playCountMinDurationMin: isNaN(val) || val < 1 ? 30 : val });
          }}
          disabled={!isEnabled || config.playCountMinDurationMin === null}
          className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
        />
        <p className="text-xs text-gray-400 mt-1">
          세션의 총 참여시간이 N분 이상인 세션만 유효한 1회로 인정합니다. 체크 해제 시 비활성화 (모든 세션 인정).
        </p>
      </div>

      {/* 플레이횟수 시간 간격 */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <input
            id="play-count-interval-enabled"
            type="checkbox"
            checked={config.playCountIntervalMin !== null}
            onChange={(e) => {
              if (e.target.checked) {
                onChange({ playCountIntervalMin: 30 });
              } else {
                onChange({ playCountIntervalMin: null });
              }
            }}
            disabled={!isEnabled}
            className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 disabled:cursor-not-allowed"
          />
          <label
            htmlFor="play-count-interval-enabled"
            className="text-sm font-medium text-gray-700"
          >
            플레이횟수 시간 간격 (분)
          </label>
        </div>
        <input
          id="play-count-interval"
          type="number"
          min={1}
          max={9999}
          value={config.playCountIntervalMin ?? 30}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            onChange({ playCountIntervalMin: isNaN(val) || val < 1 ? 30 : val });
          }}
          disabled={!isEnabled || config.playCountIntervalMin === null}
          className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
        />
        <p className="text-xs text-gray-400 mt-1">
          이전 유효 세션 시작 후 N분 이내에 재입장한 세션은 동일 1회로 병합합니다. 체크 해제 시 비활성화 (독립 카운트).
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

      <hr className="border-gray-200" />

      {/* 템플릿 설정 섹션 */}
      <MissionTemplateSection
        template={missionTemplate}
        onChange={onMissionTemplateChange}
        onSave={onSaveMissionTemplate}
        isSaving={isSavingMissionTemplate}
        saveError={missionTemplateSaveError}
        saveSuccess={missionTemplateSaveSuccess}
        isEnabled={isEnabled}
      />
    </div>
  );
}
