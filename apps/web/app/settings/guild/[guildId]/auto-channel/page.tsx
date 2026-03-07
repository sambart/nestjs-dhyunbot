"use client";

import { Loader2, Plus, RefreshCw, Server, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import type { DiscordChannel } from "../../../../lib/discord-api";
import { fetchGuildChannels } from "../../../../lib/discord-api";
import { useSettings } from "../../../SettingsContext";

// ─── 타입 ──────────────────────────────────────────────────────

interface SubOptionForm {
  label: string;
  emoji: string;
  channelSuffix: string;
}

interface ButtonForm {
  label: string;
  emoji: string;
  targetCategoryId: string;
  channelNameTemplate: string;
  subOptions: SubOptionForm[];
}

interface ConfigForm {
  triggerChannelId: string;
  guideChannelId: string;
  guideMessage: string;
  embedTitle: string;
  embedColor: string;
  buttons: ButtonForm[];
}

const EMPTY_BUTTON: ButtonForm = {
  label: "",
  emoji: "",
  targetCategoryId: "",
  channelNameTemplate: "",
  subOptions: [],
};

const EMPTY_SUB: SubOptionForm = { label: "", emoji: "", channelSuffix: "" };

const EMPTY_CONFIG: ConfigForm = {
  triggerChannelId: "",
  guideChannelId: "",
  guideMessage: "",
  embedTitle: "",
  embedColor: "#5865F2",
  buttons: [],
};

// ─── 컴포넌트 ──────────────────────────────────────────────────

export default function AutoChannelSettingsPage() {
  const { selectedGuildId } = useSettings();

  const [form, setForm] = useState<ConfigForm>(EMPTY_CONFIG);
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasExisting, setHasExisting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const voiceChannels = channels.filter((c) => c.type === 2);
  const textChannels = channels.filter((c) => c.type === 0);
  const categories = channels.filter((c) => c.type === 4);

  // 데이터 로드
  useEffect(() => {
    if (!selectedGuildId) return;

    setIsLoading(true);
    setForm(EMPTY_CONFIG);
    setHasExisting(false);

    Promise.all([
      fetch(`/api/guilds/${selectedGuildId}/auto-channel`)
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
      fetchGuildChannels(selectedGuildId),
    ])
      .then(([configs, chs]) => {
        setChannels(chs);

        if (Array.isArray(configs) && configs.length > 0) {
          const cfg = configs[0];
          setHasExisting(true);
          setForm({
            triggerChannelId: cfg.triggerChannelId ?? "",
            guideChannelId: cfg.guideChannelId ?? "",
            guideMessage: cfg.guideMessage ?? "",
            embedTitle: cfg.embedTitle ?? "",
            embedColor: cfg.embedColor ?? "#5865F2",
            buttons: (cfg.buttons ?? [])
              .sort((a: { sortOrder: number }, b: { sortOrder: number }) => a.sortOrder - b.sortOrder)
              .map((btn: { label: string; emoji: string | null; targetCategoryId: string; channelNameTemplate: string | null; subOptions: { label: string; emoji: string | null; channelSuffix: string; sortOrder: number }[] }) => ({
                label: btn.label,
                emoji: btn.emoji ?? "",
                targetCategoryId: btn.targetCategoryId,
                channelNameTemplate: btn.channelNameTemplate ?? "",
                subOptions: (btn.subOptions ?? [])
                  .sort((a: { sortOrder: number }, b: { sortOrder: number }) => a.sortOrder - b.sortOrder)
                  .map((s: { label: string; emoji: string | null; channelSuffix: string }) => ({
                    label: s.label,
                    emoji: s.emoji ?? "",
                    channelSuffix: s.channelSuffix,
                  })),
              })),
          });
        }
      })
      .finally(() => setIsLoading(false));
  }, [selectedGuildId]);

  const refreshChannels = async () => {
    if (!selectedGuildId || isRefreshing) return;
    setIsRefreshing(true);
    try {
      const chs = await fetchGuildChannels(selectedGuildId, true);
      setChannels(chs);
    } finally {
      setIsRefreshing(false);
    }
  };

  // ─── 폼 헬퍼 ──────────────────────────────────────────────────

  const updateButton = (idx: number, partial: Partial<ButtonForm>) => {
    setForm((prev) => ({
      ...prev,
      buttons: prev.buttons.map((b, i) => (i === idx ? { ...b, ...partial } : b)),
    }));
  };

  const removeButton = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      buttons: prev.buttons.filter((_, i) => i !== idx),
    }));
  };

  const addSubOption = (btnIdx: number) => {
    setForm((prev) => ({
      ...prev,
      buttons: prev.buttons.map((b, i) =>
        i === btnIdx ? { ...b, subOptions: [...b.subOptions, { ...EMPTY_SUB }] } : b,
      ),
    }));
  };

  const updateSubOption = (btnIdx: number, subIdx: number, partial: Partial<SubOptionForm>) => {
    setForm((prev) => ({
      ...prev,
      buttons: prev.buttons.map((b, i) =>
        i === btnIdx
          ? {
              ...b,
              subOptions: b.subOptions.map((s, j) => (j === subIdx ? { ...s, ...partial } : s)),
            }
          : b,
      ),
    }));
  };

  const removeSubOption = (btnIdx: number, subIdx: number) => {
    setForm((prev) => ({
      ...prev,
      buttons: prev.buttons.map((b, i) =>
        i === btnIdx ? { ...b, subOptions: b.subOptions.filter((_, j) => j !== subIdx) } : b,
      ),
    }));
  };

  // ─── 저장 ──────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!selectedGuildId || isSaving) return;
    if (!form.triggerChannelId) {
      setSaveError("대기 채널을 선택하세요.");
      return;
    }
    if (!form.guideChannelId) {
      setSaveError("안내 메시지 채널을 선택하세요.");
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const body = {
      triggerChannelId: form.triggerChannelId,
      guideChannelId: form.guideChannelId,
      guideMessage: form.guideMessage,
      embedTitle: form.embedTitle || null,
      embedColor: form.embedColor || null,
      buttons: form.buttons.map((b, i) => ({
        label: b.label,
        emoji: b.emoji.trim() || undefined,
        targetCategoryId: b.targetCategoryId,
        channelNameTemplate: b.channelNameTemplate || undefined,
        sortOrder: i,
        subOptions: b.subOptions.map((s, j) => ({
          label: s.label,
          emoji: s.emoji.trim() || undefined,
          channelSuffix: s.channelSuffix,
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
      setSaveSuccess(true);
      setHasExisting(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
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

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          자동방 설정 {hasExisting && <span className="text-sm font-normal text-gray-400">(수정)</span>}
        </h1>
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

      {/* 대기 채널 */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">대기 채널</h2>
        <p className="text-xs text-gray-400 mb-2">유저가 입장하는 영구 음성 채널입니다.</p>
        <select
          value={form.triggerChannelId}
          onChange={(e) => setForm((f) => ({ ...f, triggerChannelId: e.target.value }))}
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
          value={form.guideChannelId}
          onChange={(e) => setForm((f) => ({ ...f, guideChannelId: e.target.value }))}
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
            <label htmlFor="ac-embed-title" className="block text-sm font-medium text-gray-700 mb-1">
              Embed 제목 <span className="text-gray-400 font-normal">(선택)</span>
            </label>
            <input
              id="ac-embed-title"
              type="text"
              value={form.embedTitle}
              onChange={(e) => setForm((f) => ({ ...f, embedTitle: e.target.value }))}
              placeholder="예: 자동방 입장 안내"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Embed 설명 */}
          <div>
            <label htmlFor="ac-embed-desc" className="block text-sm font-medium text-gray-700 mb-1">
              Embed 설명 <span className="text-red-500">*</span>
            </label>
            <textarea
              id="ac-embed-desc"
              value={form.guideMessage}
              onChange={(e) => setForm((f) => ({ ...f, guideMessage: e.target.value }))}
              placeholder="안내 채널에 표시될 안내 문구를 입력하세요."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Embed 색상 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Embed 색상</label>
            <div className="flex items-center space-x-3">
              <input
                type="color"
                value={form.embedColor}
                onChange={(e) => setForm((f) => ({ ...f, embedColor: e.target.value }))}
                aria-label="Embed 색상 피커"
                className="h-9 w-16 border border-gray-300 rounded cursor-pointer p-1"
              />
              <input
                type="text"
                value={form.embedColor}
                onChange={(e) => {
                  const val = e.target.value;
                  if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                    setForm((f) => ({ ...f, embedColor: val }));
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
                style={{ borderLeft: `4px solid ${form.embedColor || "#5865F2"}` }}
              >
                <div className="p-4">
                  {form.embedTitle && (
                    <p className="text-white font-semibold text-sm mb-1 break-words">
                      {form.embedTitle}
                    </p>
                  )}
                  <p className="text-gray-300 text-xs whitespace-pre-wrap break-words">
                    {form.guideMessage || "(설명 없음)"}
                  </p>
                  {form.buttons.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {form.buttons.map((btn, idx) => (
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
            버튼 ({form.buttons.length}개)
          </h2>
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, buttons: [...f.buttons, { ...EMPTY_BUTTON, subOptions: [] }] }))}
            disabled={form.buttons.length >= 25}
            className="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>버튼 추가</span>
          </button>
        </div>

        {form.buttons.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">
            아직 버튼이 없습니다. 위의 &quot;버튼 추가&quot;를 클릭하세요.
          </p>
        )}

        <div className="space-y-4">
          {form.buttons.map((btn, bIdx) => (
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
                  <label className="block text-xs font-medium text-gray-600 mb-1">이모지 (선택)</label>
                  <input
                    type="text"
                    value={btn.emoji}
                    onChange={(e) => updateButton(bIdx, { emoji: e.target.value })}
                    placeholder="🎮"
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">대상 카테고리</label>
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
                  <code className="bg-gray-100 px-1 rounded">{"{n}"}</code> — 자동 증가 번호 (예: <code className="bg-gray-100 px-1 rounded">오버워치 #{"{n}"}</code> → 오버워치 #1, #2, ...).
                  비우면 기본값: <code className="bg-gray-100 px-1 rounded">{`{username}의 ${btn.label || "라벨"}`}</code>
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

                {btn.subOptions.map((sub, sIdx) => (
                  <div key={sIdx} className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      value={sub.label}
                      onChange={(e) => updateSubOption(bIdx, sIdx, { label: e.target.value })}
                      placeholder="라벨"
                      className="flex-1 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <input
                      type="text"
                      value={sub.emoji}
                      onChange={(e) => updateSubOption(bIdx, sIdx, { emoji: e.target.value })}
                      placeholder="🎯"
                      className="w-12 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <input
                      type="text"
                      value={sub.channelSuffix}
                      onChange={(e) => updateSubOption(bIdx, sIdx, { channelSuffix: e.target.value })}
                      placeholder="접미사"
                      className="w-24 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
          {saveSuccess && (
            <p className="text-sm text-green-600 font-medium">저장되었습니다.</p>
          )}
          {saveError && (
            <p className="text-sm text-red-600 font-medium">{saveError}</p>
          )}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {isSaving ? "저장 중..." : "저장"}
        </button>
      </div>
    </div>
  );
}
