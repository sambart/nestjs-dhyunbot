'use client';

import { Loader2, Pin, RefreshCw, Server, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import GuildEmojiPicker from '../../../../components/GuildEmojiPicker';
import type { DiscordChannel, DiscordEmoji } from '../../../../lib/discord-api';
import { fetchGuildEmojis, fetchGuildTextChannels } from '../../../../lib/discord-api';
import type { StickyMessageConfig, StickyMessageSaveDto } from '../../../../lib/sticky-message-api';
import {
  deleteStickyMessage,
  fetchStickyMessages,
  saveStickyMessage,
} from '../../../../lib/sticky-message-api';
import { useSettings } from '../../../SettingsContext';

// ─── 로컬 타입 ─────────────────────────────────────────────────────────────

/** 클라이언트 폼 상태 — 미저장 카드도 표현 가능 */
interface CardForm {
  /** DB ID. null이면 아직 저장되지 않은 신규 카드 */
  id: number | null;
  /** 임시 클라이언트 키 (React key용). 항상 존재 */
  clientKey: number;
  channelId: string;
  embedTitle: string;
  embedDescription: string;
  embedColor: string;
  enabled: boolean;
  sortOrder: number;
}

/** 카드별 저장/삭제 상태 */
interface CardState {
  isSaving: boolean;
  isDeleting: boolean;
  saveSuccess: boolean;
  saveError: string | null;
}

const DEFAULT_CARD_STATE: CardState = {
  isSaving: false,
  isDeleting: false,
  saveSuccess: false,
  saveError: null,
};

const DEFAULT_EMBED_COLOR = '#5865F2';

// ─── 컴포넌트 ───────────────────────────────────────────────────────────────

export default function StickyMessageSettingsPage() {
  const { selectedGuildId } = useSettings();

  const [cards, setCards] = useState<CardForm[]>([]);
  const [cardStates, setCardStates] = useState<Map<number, CardState>>(new Map());
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [emojis, setEmojis] = useState<DiscordEmoji[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  /** 각 카드의 embedDescription textarea ref — clientKey → ref */
  const embedDescRefs = useRef<Map<number, HTMLTextAreaElement>>(new Map());

  // ─── 카드 상태 헬퍼 ───────────────────────────────────────────────────────

  const getCardState = (clientKey: number): CardState =>
    cardStates.get(clientKey) ?? DEFAULT_CARD_STATE;

  const setCardState = (clientKey: number, partial: Partial<CardState>) => {
    setCardStates((prev) => {
      const next = new Map(prev);
      next.set(clientKey, { ...(prev.get(clientKey) ?? DEFAULT_CARD_STATE), ...partial });
      return next;
    });
  };

  // ─── 초기 데이터 로드 ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedGuildId) return;

    setIsLoading(true);
    setCards([]);
    setCardStates(new Map());

    Promise.all([
      fetchStickyMessages(selectedGuildId).catch((): StickyMessageConfig[] => []),
      fetchGuildTextChannels(selectedGuildId).catch((): DiscordChannel[] => []),
      fetchGuildEmojis(selectedGuildId).catch((): DiscordEmoji[] => []),
    ])
      .then(([configs, chs, ems]) => {
        const loaded: CardForm[] = configs.map((c) => ({
          id: c.id,
          clientKey: c.id,
          channelId: c.channelId,
          embedTitle: c.embedTitle ?? '',
          embedDescription: c.embedDescription ?? '',
          embedColor: c.embedColor ?? DEFAULT_EMBED_COLOR,
          enabled: c.enabled,
          sortOrder: c.sortOrder,
        }));
        setCards(loaded);
        setChannels(chs);
        setEmojis(ems);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [selectedGuildId]);

  // ─── 채널 새로고침 ────────────────────────────────────────────────────────

  const refreshChannels = async () => {
    if (!selectedGuildId || isRefreshing) return;
    setIsRefreshing(true);
    try {
      const [chs, ems] = await Promise.all([
        fetchGuildTextChannels(selectedGuildId, true).catch((): DiscordChannel[] => []),
        fetchGuildEmojis(selectedGuildId, true).catch((): DiscordEmoji[] => []),
      ]);
      setChannels(chs);
      setEmojis(ems);
    } finally {
      setIsRefreshing(false);
    }
  };

  // ─── 카드 CRUD ────────────────────────────────────────────────────────────

  const addCard = () => {
    const clientKey = -Date.now();
    const maxOrder = cards.reduce((m, c) => Math.max(m, c.sortOrder), -1);
    const newCard: CardForm = {
      id: null,
      clientKey,
      channelId: '',
      embedTitle: '',
      embedDescription: '',
      embedColor: DEFAULT_EMBED_COLOR,
      enabled: true,
      sortOrder: maxOrder + 1,
    };
    setCards((prev) => [...prev, newCard]);
  };

  const updateCard = (clientKey: number, patch: Partial<CardForm>) => {
    setCards((prev) =>
      prev.map((c) => (c.clientKey === clientKey ? { ...c, ...patch } : c)),
    );
  };

  // ─── 이모지 삽입 (커서 위치) ──────────────────────────────────────────────

  const insertEmojiAtCursor = (clientKey: number, insertText: string) => {
    const textarea = embedDescRefs.current.get(clientKey);
    const card = cards.find((c) => c.clientKey === clientKey);
    if (!card) return;
    const currentValue = card.embedDescription;

    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue =
        currentValue.substring(0, start) + insertText + currentValue.substring(end);
      updateCard(clientKey, { embedDescription: newValue });
      requestAnimationFrame(() => {
        textarea.focus();
        const pos = start + insertText.length;
        textarea.setSelectionRange(pos, pos);
      });
    } else {
      updateCard(clientKey, { embedDescription: currentValue + insertText });
    }
  };

  // ─── 저장 핸들러 ──────────────────────────────────────────────────────────

  const handleSave = async (clientKey: number) => {
    const card = cards.find((c) => c.clientKey === clientKey);
    if (!card || !selectedGuildId) return;

    const state = getCardState(clientKey);
    if (state.isSaving) return;

    // 유효성 검사: channelId 필수
    if (!card.channelId) {
      setCardState(clientKey, { saveError: '채널을 선택해주세요.' });
      return;
    }

    setCardState(clientKey, { isSaving: true, saveError: null, saveSuccess: false });

    const payload: StickyMessageSaveDto = {
      id: card.id,
      channelId: card.channelId,
      embedTitle: card.embedTitle || null,
      embedDescription: card.embedDescription || null,
      embedColor: card.embedColor,
      enabled: card.enabled,
      sortOrder: card.sortOrder,
    };

    try {
      const saved = await saveStickyMessage(selectedGuildId, payload);
      // 저장 후 id를 DB id로 갱신 (신규 카드의 경우 null → 실제 id로 교체)
      setCards((prev) =>
        prev.map((c) => (c.clientKey === clientKey ? { ...c, id: saved.id } : c)),
      );
      setCardState(clientKey, { isSaving: false, saveSuccess: true });
      setTimeout(() => setCardState(clientKey, { saveSuccess: false }), 3000);
    } catch (err) {
      setCardState(clientKey, {
        isSaving: false,
        saveError: err instanceof Error ? err.message : '저장에 실패했습니다.',
      });
    }
  };

  // ─── 삭제 핸들러 ──────────────────────────────────────────────────────────

  const handleDelete = async (clientKey: number) => {
    const card = cards.find((c) => c.clientKey === clientKey);
    if (!card || !selectedGuildId) return;

    // 미저장 카드(id === null)는 API 호출 없이 바로 제거
    if (card.id === null) {
      setCards((prev) => prev.filter((c) => c.clientKey !== clientKey));
      return;
    }

    const confirmed = window.confirm(
      '이 고정메세지를 삭제하면 채널에서도 즉시 제거됩니다. 삭제하시겠습니까?',
    );
    if (!confirmed) return;

    setCardState(clientKey, { isDeleting: true, saveError: null });

    try {
      await deleteStickyMessage(selectedGuildId, card.id);
      setCards((prev) => prev.filter((c) => c.clientKey !== clientKey));
      setCardStates((prev) => {
        const next = new Map(prev);
        next.delete(clientKey);
        return next;
      });
    } catch (err) {
      setCardState(clientKey, {
        isDeleting: false,
        saveError: err instanceof Error ? err.message : '삭제에 실패했습니다.',
      });
    }
  };

  // ─── 조건부 렌더링 ────────────────────────────────────────────────────────

  if (!selectedGuildId) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">고정메세지 설정</h1>
        <section className="bg-white rounded-xl border border-gray-200 p-8">
          <div className="flex flex-col items-center text-center py-8">
            <Server className="w-12 h-12 text-gray-300 mb-4" />
            <p className="text-sm text-gray-500">사이드바에서 서버를 선택하세요.</p>
          </div>
        </section>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">고정메세지 설정</h1>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
        </div>
      </div>
    );
  }

  // ─── 메인 렌더링 ──────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Pin className="w-6 h-6 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">고정메세지 설정</h1>
        </div>
        <button
          type="button"
          onClick={refreshChannels}
          disabled={isRefreshing}
          title="채널 목록 새로고침"
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>채널 새로고침</span>
        </button>
      </div>

      {/* 카드 목록 */}
      {cards.length === 0 ? (
        <section className="bg-white rounded-xl border border-gray-200 p-8">
          <div className="flex flex-col items-center text-center py-8">
            <Pin className="w-12 h-12 text-gray-300 mb-4" />
            <p className="text-sm text-gray-500">
              등록된 고정메세지가 없습니다. 아래 버튼으로 추가하세요.
            </p>
          </div>
        </section>
      ) : (
        <div className="space-y-6">
          {cards.map((card, idx) => {
            const state = getCardState(card.clientKey);
            return (
              <section
                key={card.clientKey}
                className="bg-white rounded-xl border border-gray-200 p-6"
              >
                {/* 카드 헤더 */}
                <div className="flex items-center justify-between mb-5">
                  <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-2.5 py-1 rounded-full">
                    #{idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(card.clientKey)}
                    disabled={state.isDeleting}
                    aria-label="카드 삭제"
                    className="flex items-center space-x-1 text-xs text-red-500 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{state.isDeleting ? '삭제 중...' : '삭제'}</span>
                  </button>
                </div>

                <div className="space-y-6">
                  {/* 섹션: 채널 설정 */}
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900 mb-3">채널 설정</h2>
                    <div className="space-y-4">

                      {/* 텍스트 채널 선택 */}
                      <div>
                        <label
                          htmlFor={`sm-channel-${card.clientKey}`}
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          텍스트 채널 <span className="text-red-500">*</span>
                        </label>
                        <select
                          id={`sm-channel-${card.clientKey}`}
                          value={card.channelId}
                          onChange={(e) =>
                            updateCard(card.clientKey, { channelId: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                        <p className="text-xs text-gray-400 mt-1">
                          고정메세지를 표시할 텍스트 채널
                        </p>
                      </div>

                      {/* 기능 활성화 토글 */}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">기능 활성화</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            활성화 시 저장 즉시 지정 채널에 고정메세지가 전송/갱신됩니다.
                          </p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={card.enabled}
                          onClick={() =>
                            updateCard(card.clientKey, { enabled: !card.enabled })
                          }
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                            card.enabled ? 'bg-indigo-600' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                              card.enabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                    </div>
                  </div>

                  {/* 구분선 */}
                  <hr className="border-gray-100" />

                  {/* 섹션: Embed 설정 */}
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900 mb-3">Embed 설정</h2>
                    <div className="space-y-4">

                      {/* Embed 제목 */}
                      <div>
                        <label
                          htmlFor={`sm-title-${card.clientKey}`}
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Embed 제목
                        </label>
                        <input
                          id={`sm-title-${card.clientKey}`}
                          type="text"
                          value={card.embedTitle}
                          onChange={(e) =>
                            updateCard(card.clientKey, { embedTitle: e.target.value })
                          }
                          placeholder="예: 공지 안내"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      {/* Embed 설명 */}
                      <div>
                        <label
                          htmlFor={`sm-desc-${card.clientKey}`}
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Embed 설명
                        </label>
                        <textarea
                          ref={(el) => {
                            if (el) {
                              embedDescRefs.current.set(card.clientKey, el);
                            } else {
                              embedDescRefs.current.delete(card.clientKey);
                            }
                          }}
                          id={`sm-desc-${card.clientKey}`}
                          value={card.embedDescription}
                          onChange={(e) =>
                            updateCard(card.clientKey, { embedDescription: e.target.value })
                          }
                          placeholder="예: 이 채널은 공지 전용입니다."
                          rows={4}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                        />
                        <div className="flex items-center mt-2">
                          <GuildEmojiPicker
                            emojis={emojis}
                            onSelect={(val) => insertEmojiAtCursor(card.clientKey, val)}
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
                            value={card.embedColor}
                            onChange={(e) =>
                              updateCard(card.clientKey, { embedColor: e.target.value })
                            }
                            aria-label="Embed 색상 피커"
                            className="h-9 w-16 border border-gray-300 rounded cursor-pointer p-1"
                          />
                          <input
                            type="text"
                            value={card.embedColor}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                                updateCard(card.clientKey, { embedColor: val });
                              }
                            }}
                            maxLength={7}
                            placeholder="#5865F2"
                            aria-label="Embed 색상 HEX 코드"
                            className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>

                      {/* Embed 미리보기 */}
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">미리보기</p>
                        <div className="bg-[#2B2D31] rounded-lg p-4">
                          <div
                            className="bg-[#313338] rounded-md overflow-hidden"
                            style={{
                              borderLeft: `4px solid ${card.embedColor || DEFAULT_EMBED_COLOR}`,
                            }}
                          >
                            <div className="p-4">
                              <p className="text-white font-semibold text-sm mb-1 break-words">
                                {card.embedTitle || '(제목 없음)'}
                              </p>
                              <p className="text-gray-300 text-xs whitespace-pre-wrap break-words">
                                {card.embedDescription || '(설명 없음)'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* 카드 푸터: 저장 피드백 + 저장 버튼 */}
                  <div className="flex items-center justify-between gap-4 pt-2">
                    <div className="flex-1">
                      {state.saveSuccess && (
                        <p className="text-sm text-green-600 font-medium">
                          저장되었습니다.
                        </p>
                      )}
                      {state.saveError && (
                        <p className="text-sm text-red-600 font-medium">
                          {state.saveError}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSave(card.clientKey)}
                      disabled={state.isSaving || state.isDeleting}
                      className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm"
                    >
                      {state.isSaving ? '저장 중...' : '저장'}
                    </button>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* 카드 추가 버튼 */}
      <button
        type="button"
        onClick={addCard}
        className="mt-6 w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm font-medium text-gray-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
      >
        + 고정메세지 추가
      </button>
    </div>
  );
}
