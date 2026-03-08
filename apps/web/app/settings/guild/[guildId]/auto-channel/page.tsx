"use client";

import { Loader2, Plus, RefreshCw, Server, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import GuildEmojiPicker from "../../../../components/GuildEmojiPicker";
import type { DiscordChannel, DiscordEmoji } from "../../../../lib/discord-api";
import { fetchGuildChannels, fetchGuildEmojis } from "../../../../lib/discord-api";
import { useSettings } from "../../../SettingsContext";

// ─── 타입 ──────────────────────────────────────────────────────

interface SubOptionForm {
  label: string;
  emoji: string;
  channelNameTemplate: string;
}

interface ButtonForm {
  label: string;
  emoji: string;
  targetCategoryId: string;
  channelNameTemplate: string;
  subOptions: SubOptionForm[];
}

interface ConfigForm {
  id?: number;
  name: string;
  triggerChannelId: string;
  guideChannelId: string;
  guideMessage: string;
  embedTitle: string;
  embedColor: string;
  buttons: ButtonForm[];
}

interface TabState {
  isSaving: boolean;
  saveSuccess: boolean;
  saveError: string | null;
}

const EMPTY_BUTTON: ButtonForm = {
  label: "",
  emoji: "",
  targetCategoryId: "",
  channelNameTemplate: "",
  subOptions: [],
};

const EMPTY_SUB: SubOptionForm = { label: "", emoji: "", channelNameTemplate: "" };

const EMPTY_CONFIG: ConfigForm = {
  name: "",
  triggerChannelId: "",
  guideChannelId: "",
  guideMessage: "",
  embedTitle: "",
  embedColor: "#5865F2",
  buttons: [],
};

const DEFAULT_TAB_STATE: TabState = {
  isSaving: false,
  saveSuccess: false,
  saveError: null,
};

// ─── 컴포넌트 ──────────────────────────────────────────────────

export default function AutoChannelSettingsPage() {
  const { selectedGuildId } = useSettings();

  const [tabs, setTabs] = useState<ConfigForm[]>([]);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [tabStates, setTabStates] = useState<Map<number, TabState>>(new Map());

  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [emojis, setEmojis] = useState<DiscordEmoji[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const embedDescRef = useRef<HTMLTextAreaElement>(null);

  const voiceChannels = channels.filter((c) => c.type === 2);
  const textChannels = channels.filter((c) => c.type === 0);
  const categories = channels.filter((c) => c.type === 4);

  // ─── 탭 상태 헬퍼 ─────────────────────────────────────────────

  const getTabState = (index: number): TabState =>
    tabStates.get(index) ?? DEFAULT_TAB_STATE;

  const setTabState = (index: number, partial: Partial<TabState>) => {
    setTabStates((prev) => {
      const next = new Map(prev);
      next.set(index, { ...(prev.get(index) ?? DEFAULT_TAB_STATE), ...partial });
      return next;
    });
  };

  // ─── 탭 데이터 헬퍼 ───────────────────────────────────────────

  const getCurrentTab = (): ConfigForm | undefined => tabs[activeTabIndex];

  const updateCurrentTab = (partial: Partial<ConfigForm>) => {
    setTabs((prev) =>
      prev.map((tab, i) => (i === activeTabIndex ? { ...tab, ...partial } : tab)),
    );
  };

  // ─── 데이터 로드 ──────────────────────────────────────────────

  useEffect(() => {
    if (!selectedGuildId) return;

    setIsLoading(true);
    setTabs([]);
    setActiveTabIndex(0);
    setTabStates(new Map());

    Promise.all([
      fetch(`/api/guilds/${selectedGuildId}/auto-channel`)
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
      fetchGuildChannels(selectedGuildId),
      fetchGuildEmojis(selectedGuildId),
    ])
      .then(([configs, chs, ems]) => {
        setChannels(chs);
        setEmojis(ems);

        if (Array.isArray(configs) && configs.length > 0) {
          const loaded: ConfigForm[] = configs.map(
            (cfg: {
              id: number;
              name: string;
              triggerChannelId: string;
              guideChannelId: string | null;
              guideMessage: string;
              embedTitle: string | null;
              embedColor: string | null;
              buttons: {
                label: string;
                emoji: string | null;
                targetCategoryId: string;
                channelNameTemplate: string | null;
                sortOrder: number;
                subOptions: {
                  label: string;
                  emoji: string | null;
                  channelNameTemplate: string;
                  sortOrder: number;
                }[];
              }[];
            }) => ({
              id: cfg.id,
              name: cfg.name ?? "",
              triggerChannelId: cfg.triggerChannelId ?? "",
              guideChannelId: cfg.guideChannelId ?? "",
              guideMessage: cfg.guideMessage ?? "",
              embedTitle: cfg.embedTitle ?? "",
              embedColor: cfg.embedColor ?? "#5865F2",
              buttons: (cfg.buttons ?? [])
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((btn) => ({
                  label: btn.label,
                  emoji: btn.emoji ?? "",
                  targetCategoryId: btn.targetCategoryId,
                  channelNameTemplate: btn.channelNameTemplate ?? "",
                  subOptions: (btn.subOptions ?? [])
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((s) => ({
                      label: s.label,
                      emoji: s.emoji ?? "",
                      channelNameTemplate: s.channelNameTemplate,
                    })),
                })),
            }),
          );
          setTabs(loaded);
        } else {
          setTabs([{ ...EMPTY_CONFIG }]);
        }
      })
      .finally(() => setIsLoading(false));
  }, [selectedGuildId]);

  const refreshChannels = async () => {
    if (!selectedGuildId || isRefreshing) return;
    setIsRefreshing(true);
    try {
      const [chs, ems] = await Promise.all([
        fetchGuildChannels(selectedGuildId, true),
        fetchGuildEmojis(selectedGuildId, true),
      ]);
      setChannels(chs);
      setEmojis(ems);
    } finally {
      setIsRefreshing(false);
    }
  };

  // ─── 탭 관리 ──────────────────────────────────────────────────

  const addNewTab = () => {
    setTabs((prev) => [...prev, { ...EMPTY_CONFIG }]);
    setActiveTabIndex(tabs.length);
  };

  const handleDeleteTab = async (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const tab = tabs[idx];
    if (!tab) return;

    if (!window.confirm("이 자동방 설정을 삭제하시겠습니까?")) return;

    if (tab.id !== undefined) {
      if (!selectedGuildId) return;
      try {
        const res = await fetch(
          `/api/guilds/${selectedGuildId}/auto-channel/${tab.id}`,
          { method: "DELETE" },
        );
        if (!res.ok) {
          alert(`삭제 실패 (${res.status})`);
          return;
        }
      } catch {
        alert("삭제 중 오류가 발생했습니다.");
        return;
      }
    }

    setTabs((prev) => prev.filter((_, i) => i !== idx));
    setTabStates((prev) => {
      const next = new Map<number, TabState>();
      prev.forEach((v, k) => {
        if (k < idx) next.set(k, v);
        else if (k > idx) next.set(k - 1, v);
      });
      return next;
    });
    setActiveTabIndex((prev) => {
      if (tabs.length <= 1) return 0;
      if (prev >= idx && prev > 0) return prev - 1;
      return prev;
    });
  };

  // ─── 폼 헬퍼 ──────────────────────────────────────────────────

  const insertAtCursor = (insertText: string) => {
    const textarea = embedDescRef.current;
    const tab = getCurrentTab();
    const currentValue = tab?.guideMessage ?? "";

    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue =
        currentValue.substring(0, start) + insertText + currentValue.substring(end);
      updateCurrentTab({ guideMessage: newValue });
      requestAnimationFrame(() => {
        textarea.focus();
        const pos = start + insertText.length;
        textarea.setSelectionRange(pos, pos);
      });
    } else {
      updateCurrentTab({ guideMessage: currentValue + insertText });
    }
  };

  const updateButton = (idx: number, partial: Partial<ButtonForm>) => {
    const tab = getCurrentTab();
    if (!tab) return;
    updateCurrentTab({
      buttons: tab.buttons.map((b, i) => (i === idx ? { ...b, ...partial } : b)),
    });
  };

  const removeButton = (idx: number) => {
    const tab = getCurrentTab();
    if (!tab) return;
    updateCurrentTab({ buttons: tab.buttons.filter((_, i) => i !== idx) });
  };

  const addSubOption = (btnIdx: number) => {
    const tab = getCurrentTab();
    if (!tab) return;
    updateCurrentTab({
      buttons: tab.buttons.map((b, i) =>
        i === btnIdx ? { ...b, subOptions: [...b.subOptions, { ...EMPTY_SUB }] } : b,
      ),
    });
  };

  const updateSubOption = (btnIdx: number, subIdx: number, partial: Partial<SubOptionForm>) => {
    const tab = getCurrentTab();
    if (!tab) return;
    updateCurrentTab({
      buttons: tab.buttons.map((b, i) =>
        i === btnIdx
          ? {
              ...b,
              subOptions: b.subOptions.map((s, j) => (j === subIdx ? { ...s, ...partial } : s)),
            }
          : b,
      ),
    });
  };

  const removeSubOption = (btnIdx: number, subIdx: number) => {
    const tab = getCurrentTab();
    if (!tab) return;
    updateCurrentTab({
      buttons: tab.buttons.map((b, i) =>
        i === btnIdx ? { ...b, subOptions: b.subOptions.filter((_, j) => j !== subIdx) } : b,
      ),
    });
  };

  // ─── 저장 ──────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!selectedGuildId) return;
    const currentTab = getCurrentTab();
    if (!currentTab) return;

    const currentState = getTabState(activeTabIndex);
    if (currentState.isSaving) return;

    if (!currentTab.name.trim()) {
      setTabState(activeTabIndex, { saveError: "설정 이름을 입력하세요." });
      return;
    }
    if (!currentTab.triggerChannelId) {
      setTabState(activeTabIndex, { saveError: "대기 채널을 선택하세요." });
      return;
    }
    if (!currentTab.guideChannelId) {
      setTabState(activeTabIndex, { saveError: "안내 메시지 채널을 선택하세요." });
      return;
    }
    for (let i = 0; i < currentTab.buttons.length; i++) {
      const btn = currentTab.buttons[i];
      if (!btn.label.trim()) {
        setTabState(activeTabIndex, { saveError: `버튼 #${i + 1}의 라벨을 입력하세요.` });
        return;
      }
      if (!btn.targetCategoryId) {
        setTabState(activeTabIndex, {
          saveError: `버튼 #${i + 1}의 대상 카테고리를 선택하세요.`,
        });
        return;
      }
    }

    setTabState(activeTabIndex, { isSaving: true, saveError: null, saveSuccess: false });

    const body = {
      name: currentTab.name,
      triggerChannelId: currentTab.triggerChannelId,
      guideChannelId: currentTab.guideChannelId,
      guideMessage: currentTab.guideMessage,
      embedTitle: currentTab.embedTitle || null,
      embedColor: currentTab.embedColor || null,
      buttons: currentTab.buttons.map((b, i) => ({
        label: b.label,
        emoji: b.emoji.trim() || undefined,
        targetCategoryId: b.targetCategoryId,
        channelNameTemplate: b.channelNameTemplate || undefined,
        sortOrder: i,
        subOptions: b.subOptions.map((s, j) => ({
          label: s.label,
          emoji: s.emoji.trim() || undefined,
          channelNameTemplate: s.channelNameTemplate,
          sortOrder: j,
        })),
      })),
    };

    try {
      const res = await fetch(`/api/guilds/${selectedGuildId}/auto-channel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`저장 실패 (${res.status})`);
      const data = (await res.json()) as { configId: number };
      // 저장된 configId를 탭에 반영 (이후 수정 시 같은 탭으로 upsert)
      setTabs((prev) =>
        prev.map((tab, i) =>
          i === activeTabIndex ? { ...tab, id: data.configId } : tab,
        ),
      );
      setTabState(activeTabIndex, { isSaving: false, saveSuccess: true });
      setTimeout(() => setTabState(activeTabIndex, { saveSuccess: false }), 3000);
    } catch (err) {
      setTabState(activeTabIndex, {
        isSaving: false,
        saveError: err instanceof Error ? err.message : "저장에 실패했습니다.",
      });
    }
  };

  // ─── 렌더링 ────────────────────────────────────────────────────

  if (!selectedGuildId) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">자동방 설정</h1>
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
        <h1 className="text-2xl font-bold text-gray-900 mb-6">자동방 설정</h1>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
        </div>
      </div>
    );
  }

  const currentTab = getCurrentTab();
  const currentTabState = getTabState(activeTabIndex);

  return (
    <div className="max-w-3xl">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">자동방 설정</h1>
        <button
          type="button"
          onClick={refreshChannels}
          disabled={isRefreshing}
          title="채널 목록 새로고침"
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          <span>채널 새로고침</span>
        </button>
      </div>

      {/* 탭 바 */}
      <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
        {tabs.map((tab, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setActiveTabIndex(idx)}
            className={`group flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeTabIndex === idx
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <span>{tab.name.trim() || "(미저장)"}</span>
            {tab.id !== undefined && (
              <span
                role="button"
                tabIndex={-1}
                onClick={(e) => handleDeleteTab(idx, e)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleDeleteTab(idx, e as unknown as React.MouseEvent);
                  }
                }}
                className="flex items-center justify-center w-4 h-4 rounded-full hover:bg-red-100 hover:text-red-500 text-gray-400 transition-colors"
                aria-label="설정 삭제"
              >
                <X className="w-3 h-3" />
              </span>
            )}
          </button>
        ))}
        <button
          type="button"
          onClick={addNewTab}
          className="px-4 py-3 text-sm font-medium text-indigo-500 border-b-2 border-transparent hover:text-indigo-700 hover:border-indigo-300 whitespace-nowrap transition-colors"
        >
          + 추가
        </button>
      </div>

      {/* 탭 콘텐츠 */}
      {currentTab && (
        <>
          {/* 설정 이름 */}
          <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">설정 이름</h2>
            <input
              type="text"
              value={currentTab.name}
              onChange={(e) => updateCurrentTab({ name: e.target.value })}
              placeholder="예: 게임방, 공부방"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </section>

          {/* 대기 채널 */}
          <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">대기 채널</h2>
            <p className="text-xs text-gray-400 mb-2">유저가 입장하는 영구 음성 채널입니다.</p>
            <select
              value={currentTab.triggerChannelId}
              onChange={(e) => updateCurrentTab({ triggerChannelId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">음성 채널을 선택하세요</option>
              {voiceChannels.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  🔊 {ch.name}
                </option>
              ))}
            </select>
            {voiceChannels.length === 0 && (
              <p className="text-xs text-amber-500 mt-1">음성 채널을 불러올 수 없습니다.</p>
            )}
          </section>

          {/* 안내 메시지 채널 */}
          <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">안내 메시지 채널</h2>
            <p className="text-xs text-gray-400 mb-2">임베드와 버튼이 표시될 텍스트 채널입니다.</p>
            <select
              value={currentTab.guideChannelId}
              onChange={(e) => updateCurrentTab({ guideChannelId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">텍스트 채널을 선택하세요</option>
              {textChannels.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  # {ch.name}
                </option>
              ))}
            </select>
            {textChannels.length === 0 && (
              <p className="text-xs text-amber-500 mt-1">텍스트 채널을 불러올 수 없습니다.</p>
            )}
          </section>

          {/* 안내 메시지 (Embed) */}
          <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">안내 메시지 (Embed)</h2>
            <div className="space-y-4">
              {/* Embed 제목 */}
              <div>
                <label
                  htmlFor={`ac-embed-title-${activeTabIndex}`}
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Embed 제목 <span className="text-gray-400 font-normal">(선택)</span>
                </label>
                <input
                  id={`ac-embed-title-${activeTabIndex}`}
                  type="text"
                  value={currentTab.embedTitle}
                  onChange={(e) => updateCurrentTab({ embedTitle: e.target.value })}
                  placeholder="예: 자동방 입장 안내"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Embed 설명 */}
              <div>
                <label
                  htmlFor={`ac-embed-desc-${activeTabIndex}`}
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Embed 설명 <span className="text-red-500">*</span>
                </label>
                <textarea
                  ref={embedDescRef}
                  id={`ac-embed-desc-${activeTabIndex}`}
                  value={currentTab.guideMessage}
                  onChange={(e) => updateCurrentTab({ guideMessage: e.target.value })}
                  placeholder="안내 채널에 표시될 안내 문구를 입력하세요."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
                <div className="flex items-center mt-2">
                  <GuildEmojiPicker emojis={emojis} onSelect={(val) => insertAtCursor(val)} />
                </div>
              </div>

              {/* Embed 색상 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Embed 색상</label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    value={currentTab.embedColor}
                    onChange={(e) => updateCurrentTab({ embedColor: e.target.value })}
                    aria-label="Embed 색상 피커"
                    className="h-9 w-16 border border-gray-300 rounded cursor-pointer p-1"
                  />
                  <input
                    type="text"
                    value={currentTab.embedColor}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                        updateCurrentTab({ embedColor: val });
                      }
                    }}
                    maxLength={7}
                    placeholder="#5865F2"
                    aria-label="Embed 색상 HEX 코드"
                    className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* 미리보기 */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">미리보기</p>
                <div className="bg-[#2B2D31] rounded-lg p-4">
                  <div
                    className="bg-[#313338] rounded-md overflow-hidden"
                    style={{ borderLeft: `4px solid ${currentTab.embedColor || "#5865F2"}` }}
                  >
                    <div className="p-4">
                      {currentTab.embedTitle && (
                        <p className="text-white font-semibold text-sm mb-1 break-words">
                          {currentTab.embedTitle}
                        </p>
                      )}
                      <p className="text-gray-300 text-xs whitespace-pre-wrap break-words">
                        {currentTab.guideMessage || "(설명 없음)"}
                      </p>
                      {currentTab.buttons.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {currentTab.buttons.map((btn, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1 bg-indigo-500 text-white text-xs rounded font-medium"
                            >
                              {btn.emoji ? `${btn.emoji} ` : ""}
                              {btn.label || "(라벨 없음)"}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 버튼 목록 */}
          <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">
                버튼 ({currentTab.buttons.length}개)
              </h2>
              <button
                type="button"
                onClick={() =>
                  updateCurrentTab({
                    buttons: [...currentTab.buttons, { ...EMPTY_BUTTON, subOptions: [] }],
                  })
                }
                disabled={currentTab.buttons.length >= 25}
                className="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>버튼 추가</span>
              </button>
            </div>

            {currentTab.buttons.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">
                아직 버튼이 없습니다. 위의 &quot;버튼 추가&quot;를 클릭하세요.
              </p>
            )}

            <div className="space-y-4">
              {currentTab.buttons.map((btn, bIdx) => (
                <div key={bIdx} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-xs font-semibold text-gray-500">버튼 #{bIdx + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeButton(bIdx)}
                      className="text-red-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">라벨</label>
                      <input
                        type="text"
                        value={btn.label}
                        onChange={(e) => updateButton(bIdx, { label: e.target.value })}
                        placeholder="오버워치"
                        className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        이모지 (선택)
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={btn.emoji}
                          onChange={(e) => updateButton(bIdx, { emoji: e.target.value })}
                          placeholder="🎮"
                          className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <GuildEmojiPicker
                          emojis={emojis}
                          onSelect={(val) => updateButton(bIdx, { emoji: val })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      대상 카테고리
                    </label>
                    <select
                      value={btn.targetCategoryId}
                      onChange={(e) => updateButton(bIdx, { targetCategoryId: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">카테고리 선택</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          📁 {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      채널명 템플릿 <span className="text-gray-400 font-normal">(선택)</span>
                    </label>
                    <input
                      type="text"
                      value={btn.channelNameTemplate}
                      onChange={(e) => updateButton(bIdx, { channelNameTemplate: e.target.value })}
                      placeholder={`{username}의 ${btn.label || "게임"}`}
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      <code className="bg-gray-100 px-1 rounded">{"{username}"}</code> — 유저 닉네임,{" "}
                      <code className="bg-gray-100 px-1 rounded">{"{n}"}</code> — 자동 증가 번호 (예:{" "}
                      <code className="bg-gray-100 px-1 rounded">오버워치 #{"{n}"}</code> → 오버워치
                      #1, #2, ...). 비우면 기본값:{" "}
                      <code className="bg-gray-100 px-1 rounded">{`{username}의 ${btn.label || "라벨"}`}</code>
                    </p>
                  </div>

                  {/* 하위 선택지 */}
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-600">
                        하위 선택지 ({btn.subOptions.length}개)
                      </span>
                      <button
                        type="button"
                        onClick={() => addSubOption(bIdx)}
                        className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
                      >
                        + 추가
                      </button>
                    </div>

                    {btn.subOptions.length > 0 && (
                      <>
                        <p className="text-xs text-gray-400 mb-2">
                          채널명 템플릿에서{" "}
                          <code className="bg-gray-100 px-1 rounded">{"{name}"}</code>은 버튼의 기본
                          채널명으로 치환됩니다. 예:{" "}
                          <code className="bg-gray-100 px-1 rounded">일반 {"{name}"}</code> →{" "}
                          <code className="bg-gray-100 px-1 rounded">일반 DHyun의 오버워치</code>
                        </p>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-20 text-[10px] font-medium text-gray-400">라벨</span>
                          <span className="w-[4.5rem] text-[10px] font-medium text-gray-400">
                            이모지
                          </span>
                          <span className="flex-1 text-[10px] font-medium text-gray-400">
                            채널명 템플릿
                          </span>
                          <span className="w-3.5" />
                        </div>
                      </>
                    )}

                    {btn.subOptions.map((sub, sIdx) => (
                      <div key={sIdx} className="flex items-center gap-2 mb-2">
                        <input
                          type="text"
                          value={sub.label}
                          onChange={(e) => updateSubOption(bIdx, sIdx, { label: e.target.value })}
                          placeholder="라벨"
                          className="w-20 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={sub.emoji}
                            onChange={(e) =>
                              updateSubOption(bIdx, sIdx, { emoji: e.target.value })
                            }
                            placeholder="🎯"
                            className="w-12 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <GuildEmojiPicker
                            emojis={emojis}
                            onSelect={(val) => updateSubOption(bIdx, sIdx, { emoji: val })}
                          />
                        </div>
                        <input
                          type="text"
                          value={sub.channelNameTemplate}
                          onChange={(e) =>
                            updateSubOption(bIdx, sIdx, { channelNameTemplate: e.target.value })
                          }
                          placeholder="일반 {name}"
                          className="flex-1 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => removeSubOption(bIdx, sIdx)}
                          className="text-red-400 hover:text-red-600 transition-colors flex-shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 저장 */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              {currentTabState.saveSuccess && (
                <p className="text-sm text-green-600 font-medium">저장되었습니다.</p>
              )}
              {currentTabState.saveError && (
                <p className="text-sm text-red-600 font-medium">{currentTabState.saveError}</p>
              )}
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={currentTabState.isSaving}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {currentTabState.isSaving ? "저장 중..." : "저장"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
