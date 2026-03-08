'use client';

import { useRef } from 'react';

import GuildEmojiPicker from '../../../../../components/GuildEmojiPicker';
import type { DiscordChannel, DiscordEmoji } from '../../../../../lib/discord-api';
import type { NewbieConfig } from '../../../../../lib/newbie-api';
import EmbedPreview from './EmbedPreview';

interface WelcomeTabProps {
  config: NewbieConfig;
  channels: DiscordChannel[];
  emojis: DiscordEmoji[];
  onChange: (partial: Partial<NewbieConfig>) => void;
}

const TEMPLATE_VARIABLES = [
  { variable: '{username}', description: '신규 멤버의 닉네임' },
  { variable: '{mention}', description: '신규 멤버 태그 (@멘션)' },
  { variable: '{memberCount}', description: '현재 서버 전체 멤버 수' },
  { variable: '{serverName}', description: '서버 이름' },
] as const;

export default function WelcomeTab({ config, channels, emojis, onChange }: WelcomeTabProps) {
  const isEnabled = config.welcomeEnabled;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const channelSelectRef = useRef<HTMLSelectElement>(null);

  const insertAtCursor = (insertText: string) => {
    const textarea = textareaRef.current;
    const currentValue = config.welcomeEmbedDescription ?? '';

    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue =
        currentValue.substring(0, start) +
        insertText +
        currentValue.substring(end);

      onChange({ welcomeEmbedDescription: newValue || null });

      requestAnimationFrame(() => {
        textarea.focus();
        const pos = start + insertText.length;
        textarea.setSelectionRange(pos, pos);
      });
    } else {
      onChange({
        welcomeEmbedDescription: (currentValue + insertText) || null,
      });
    }
  };

  const handleInsertChannel = (channelId: string) => {
    insertAtCursor(`<#${channelId}>`);
  };

  return (
    <div className="space-y-6">
      {/* 기능 활성화 토글 */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">환영인사 기능</p>
          <p className="text-xs text-gray-500 mt-0.5">
            신규 멤버 가입 시 환영 메시지를 자동으로 전송합니다.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isEnabled}
          onClick={() => onChange({ welcomeEnabled: !isEnabled })}
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

      {/* 채널 선택 */}
      <div>
        <label
          htmlFor="welcome-channel"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          환영 메시지 채널
        </label>
        <select
          id="welcome-channel"
          value={config.welcomeChannelId ?? ''}
          onChange={(e) =>
            onChange({ welcomeChannelId: e.target.value || null })
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
        {channels.length === 0 && (
          <p className="text-xs text-gray-400 mt-1">
            채널 목록을 불러올 수 없습니다. 백엔드 연동 후 사용 가능합니다.
          </p>
        )}
      </div>

      {/* Embed 제목 */}
      <div>
        <label
          htmlFor="welcome-embed-title"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Embed 제목
        </label>
        <input
          id="welcome-embed-title"
          type="text"
          value={config.welcomeEmbedTitle ?? ''}
          onChange={(e) =>
            onChange({ welcomeEmbedTitle: e.target.value || null })
          }
          disabled={!isEnabled}
          placeholder="예: {serverName}에 오신 것을 환영합니다!"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
        />
      </div>

      {/* Embed 설명 (멀티라인) */}
      <div>
        <label
          htmlFor="welcome-embed-description"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Embed 설명
        </label>
        <textarea
          ref={textareaRef}
          id="welcome-embed-description"
          value={config.welcomeEmbedDescription ?? ''}
          onChange={(e) =>
            onChange({ welcomeEmbedDescription: e.target.value || null })
          }
          disabled={!isEnabled}
          placeholder="예: 안녕하세요, {username}님! 현재 서버에는 {memberCount}명이 함께하고 있어요."
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed resize-none"
        />
        {/* 채널 링크 삽입 + 이모지 삽입 */}
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
            value={config.welcomeEmbedColor ?? '#5865F2'}
            onChange={(e) => onChange({ welcomeEmbedColor: e.target.value })}
            disabled={!isEnabled}
            aria-label="Embed 색상 피커"
            className="h-9 w-16 border border-gray-300 rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed p-1"
          />
          <input
            type="text"
            value={config.welcomeEmbedColor ?? '#5865F2'}
            onChange={(e) => {
              const val = e.target.value;
              if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                onChange({ welcomeEmbedColor: val });
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
          htmlFor="welcome-thumbnail-url"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          썸네일 이미지 URL
        </label>
        <input
          id="welcome-thumbnail-url"
          type="url"
          value={config.welcomeEmbedThumbnailUrl ?? ''}
          onChange={(e) =>
            onChange({ welcomeEmbedThumbnailUrl: e.target.value || null })
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
          {TEMPLATE_VARIABLES.map((item) => (
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
        title={config.welcomeEmbedTitle}
        description={config.welcomeEmbedDescription}
        color={config.welcomeEmbedColor}
        thumbnailUrl={config.welcomeEmbedThumbnailUrl}
        channels={channels}
      />
    </div>
  );
}
