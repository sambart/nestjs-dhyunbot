'use client';

import type { DiscordChannel, DiscordEmoji } from '../../../../../lib/discord-api';
import type { MocoTemplate, NewbieConfig } from '../../../../../lib/newbie-api';
import MocoTemplateSection from './MocoTemplateSection';

interface MocoTabProps {
  config: NewbieConfig;
  channels: DiscordChannel[];
  emojis: DiscordEmoji[];
  onChange: (partial: Partial<NewbieConfig>) => void;
  mocoTemplate: MocoTemplate;
  onMocoTemplateChange: (template: MocoTemplate) => void;
  onSaveMocoTemplate: () => void;
  isSavingMocoTemplate: boolean;
  mocoTemplateSaveError: string | null;
  mocoTemplateSaveSuccess: boolean;
}

export default function MocoTab({
  config,
  channels,
  onChange,
  mocoTemplate,
  onMocoTemplateChange,
  onSaveMocoTemplate,
  isSavingMocoTemplate,
  mocoTemplateSaveError,
  mocoTemplateSaveSuccess,
}: MocoTabProps) {
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

      {/* 모코코도 사냥꾼 허용 토글 */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-700">모코코도 사냥꾼 허용</p>
          <p className="text-xs text-gray-500 mt-0.5">
            활성화하면 신입(모코코)도 다른 신입의 사냥꾼이 될 수 있습니다.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={config.mocoAllowNewbieHunter}
          onClick={() => onChange({ mocoAllowNewbieHunter: !config.mocoAllowNewbieHunter })}
          disabled={!isEnabled}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
            config.mocoAllowNewbieHunter ? 'bg-indigo-600' : 'bg-gray-200'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              config.mocoAllowNewbieHunter ? 'translate-x-6' : 'translate-x-1'
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

      {/* Embed 색상 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Embed 색상
        </label>
        <div className="flex items-center space-x-3">
          <input
            type="color"
            value={config.mocoEmbedColor ?? '#5865F2'}
            onChange={(e) => onChange({ mocoEmbedColor: e.target.value })}
            disabled={!isEnabled}
            aria-label="Embed 색상 피커"
            className="h-9 w-16 border border-gray-300 rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed p-1"
          />
          <input
            type="text"
            value={config.mocoEmbedColor ?? '#5865F2'}
            onChange={(e) => {
              const val = e.target.value;
              if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                onChange({ mocoEmbedColor: val });
              }
            }}
            disabled={!isEnabled}
            maxLength={7}
            placeholder="#5865F2"
            aria-label="Embed 색상 HEX 코드"
            className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
          />
        </div>
      </div>

      <hr className="border-gray-200" />

      {/* 템플릿 설정 섹션 */}
      <MocoTemplateSection
        template={mocoTemplate}
        onChange={onMocoTemplateChange}
        onSave={onSaveMocoTemplate}
        isSaving={isSavingMocoTemplate}
        saveError={mocoTemplateSaveError}
        saveSuccess={mocoTemplateSaveSuccess}
        isEnabled={isEnabled}
      />
    </div>
  );
}
