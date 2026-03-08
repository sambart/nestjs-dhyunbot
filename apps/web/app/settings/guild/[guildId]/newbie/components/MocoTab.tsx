'use client';

import { useRef } from 'react';

import GuildEmojiPicker from '../../../../../components/GuildEmojiPicker';
import type { DiscordChannel, DiscordEmoji } from '../../../../../lib/discord-api';
import type { NewbieConfig } from '../../../../../lib/newbie-api';
import EmbedPreview from './EmbedPreview';

const MOCO_TEMPLATE_VARIABLES = [
  { variable: '{rank}', description: '현재 표시 중인 순위' },
  { variable: '{hunterName}', description: '사냥꾼(기존 멤버)의 닉네임' },
  { variable: '{totalMinutes}', description: '총 모코코 사냥 시간(분)' },
  { variable: '{rankDetails}', description: '자동 생성된 순위 상세 (사냥 시간 + 모코코 목록)' },
] as const;

const SAMPLE_RANK_DETAILS =
  '총 모코코 사냥 시간: 120분\n\n도움을 받은 모코코들:\n– 신입1 🌱: 60분\n– 신입2 🌱: 60분';

interface MocoTabProps {
  config: NewbieConfig;
  channels: DiscordChannel[];
  emojis: DiscordEmoji[];
  onChange: (partial: Partial<NewbieConfig>) => void;
}

export default function MocoTab({ config, channels, emojis, onChange }: MocoTabProps) {
  const isEnabled = config.mocoEnabled;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const channelSelectRef = useRef<HTMLSelectElement>(null);

  const insertAtCursor = (insertText: string) => {
    const textarea = textareaRef.current;
    const currentValue = config.mocoEmbedDescription ?? '';

    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue =
        currentValue.substring(0, start) +
        insertText +
        currentValue.substring(end);

      onChange({ mocoEmbedDescription: newValue || null });

      requestAnimationFrame(() => {
        textarea.focus();
        const pos = start + insertText.length;
        textarea.setSelectionRange(pos, pos);
      });
    } else {
      onChange({
        mocoEmbedDescription: (currentValue + insertText) || null,
      });
    }
  };

  const handleInsertChannel = (channelId: string) => {
    insertAtCursor(`<#${channelId}>`);
  };

  const previewDescription = (config.mocoEmbedDescription ?? '{rankDetails}')
    .replace(/\{rankDetails\}/g, SAMPLE_RANK_DETAILS)
    .replace(/\{rank\}/g, '1')
    .replace(/\{hunterName\}/g, '사냥꾼닉네임')
    .replace(/\{totalMinutes\}/g, '120');

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

      {/* Embed 제목 */}
      <div>
        <label
          htmlFor="moco-embed-title"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Embed 제목
        </label>
        <input
          id="moco-embed-title"
          type="text"
          value={config.mocoEmbedTitle ?? ''}
          onChange={(e) =>
            onChange({ mocoEmbedTitle: e.target.value || null })
          }
          disabled={!isEnabled}
          placeholder="예: 모코코 사냥 TOP {rank} — {hunterName} 🌱"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
        />
        <p className="text-xs text-gray-400 mt-1">
          비워두면 기본값: 모코코 사냥 TOP {'{rank}'} — {'{hunterName}'} 🌱
        </p>
      </div>

      {/* Embed 설명 (멀티라인) */}
      <div>
        <label
          htmlFor="moco-embed-description"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Embed 설명
        </label>
        <textarea
          ref={textareaRef}
          id="moco-embed-description"
          value={config.mocoEmbedDescription ?? ''}
          onChange={(e) =>
            onChange({ mocoEmbedDescription: e.target.value || null })
          }
          disabled={!isEnabled}
          placeholder="비워두면 순위 상세만 표시됩니다. {rankDetails}로 순위 상세 위치를 지정할 수 있습니다."
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed resize-none"
        />
        {/* 채널 링크 삽입 */}
        <div className="flex items-center space-x-2 mt-2">
          <select
            ref={channelSelectRef}
            disabled={!isEnabled || channels.length === 0}
            className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            <option value="">채널 링크 삽입</option>
            {channels.map((ch) => (
              <option key={ch.id} value={ch.id}>
                # {ch.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!isEnabled}
            onClick={() => {
              const sel = channelSelectRef.current;
              if (sel?.value) {
                handleInsertChannel(sel.value);
                sel.value = '';
              }
            }}
            className="px-3 py-1.5 bg-indigo-100 text-indigo-700 text-sm font-medium rounded-lg hover:bg-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            삽입
          </button>
          <GuildEmojiPicker
            emojis={emojis}
            onSelect={(val) => insertAtCursor(val)}
            disabled={!isEnabled}
          />
        </div>
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

      {/* 썸네일 이미지 URL */}
      <div>
        <label
          htmlFor="moco-thumbnail-url"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          썸네일 이미지 URL
        </label>
        <input
          id="moco-thumbnail-url"
          type="url"
          value={config.mocoEmbedThumbnailUrl ?? ''}
          onChange={(e) =>
            onChange({ mocoEmbedThumbnailUrl: e.target.value || null })
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
          {MOCO_TEMPLATE_VARIABLES.map((item) => (
            <div key={item.variable} className="flex items-center space-x-2">
              <code className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-mono">
                {item.variable}
              </code>
              <span className="text-xs text-indigo-600">{item.description}</span>
            </div>
          ))}
        </dl>
        <div className="mt-3 pt-3 border-t border-indigo-200">
          <p className="text-xs font-semibold text-indigo-700 mb-1.5">
            채널 링크
          </p>
          <div className="flex items-center space-x-2">
            <code className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-mono">
              {'<#채널ID>'}
            </code>
            <span className="text-xs text-indigo-600">
              클릭 가능한 채널 링크 (위 드롭다운으로 삽입)
            </span>
          </div>
        </div>
      </div>

      {/* Embed 미리보기 */}
      <EmbedPreview
        title={
          (config.mocoEmbedTitle ?? '모코코 사냥 TOP {rank} — {hunterName} 🌱')
            .replace(/\{rank\}/g, '1')
            .replace(/\{hunterName\}/g, '사냥꾼닉네임')
        }
        description={previewDescription}
        color={config.mocoEmbedColor}
        thumbnailUrl={config.mocoEmbedThumbnailUrl}
        channels={channels}
      />
    </div>
  );
}
