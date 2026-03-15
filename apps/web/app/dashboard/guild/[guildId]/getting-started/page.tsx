"use client";

import {
  Bell,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Mic,
  Shield,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { fetchBotStatus } from "@/app/lib/monitoring-api";

// ─── 상수 ──────────────────────────────────────────────────────────────────

const STEP_COUNT = 4;

interface StepMeta {
  id: number;
  title: string;
  subtitle: string;
}

const STEPS: StepMeta[] = [
  { id: 1, title: "봇 권한 확인", subtitle: "봇이 서버에 정상 연결되어 있는지 확인합니다" },
  { id: 2, title: "음성 추적 설정", subtitle: "음성 채널 활동 추적 방식을 안내합니다" },
  { id: 3, title: "알림 채널", subtitle: "주요 알림 채널을 연결합니다" },
  { id: 4, title: "완료", subtitle: "모든 설정이 준비되었습니다" },
];

// ─── 스텝 컴포넌트들 ──────────────────────────────────────────────────────

interface StepBotPermissionProps {
  guildId: string;
}

function StepBotPermission({ guildId }: StepBotPermissionProps) {
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      setIsLoading(true);
      try {
        const status = await fetchBotStatus(guildId);
        if (!cancelled) setIsOnline(status.online);
      } catch {
        if (!cancelled) setIsOnline(false);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadStatus();
    return () => {
      cancelled = true;
    };
  }, [guildId]);

  const checks = [
    "서버 멤버 목록 읽기",
    "음성 채널 접속 상태 감지",
    "메시지 전송",
    "임베드 메시지 전송",
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
        <Shield className="h-8 w-8 flex-shrink-0 text-indigo-500" />
        <div>
          <p className="font-medium text-gray-900">봇 연결 상태</p>
          {isLoading ? (
            <p className="text-sm text-gray-400">확인 중...</p>
          ) : isOnline ? (
            <p className="text-sm text-emerald-600">온라인 — 정상 연결되어 있습니다</p>
          ) : (
            <p className="text-sm text-red-500">오프라인 — 봇이 서버에 연결되어 있지 않습니다</p>
          )}
        </div>
        <div className="ml-auto flex-shrink-0">
          {isLoading ? (
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
          ) : isOnline ? (
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          ) : (
            <XCircle className="h-6 w-6 text-red-400" />
          )}
        </div>
      </div>

      <div>
        <p className="mb-3 text-sm font-medium text-gray-700">필수 권한 목록</p>
        <ul className="space-y-2">
          {checks.map((check) => (
            <li key={check} className="flex items-center gap-3 text-sm text-gray-600">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-400" />
              {check}
            </li>
          ))}
        </ul>
      </div>

      {!isLoading && !isOnline && (
        <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          봇이 오프라인 상태입니다. 봇을 서버에 초대했는지 확인하고, 잠시 후 다시 시도해 주세요.
        </div>
      )}
    </div>
  );
}

interface StepVoiceTrackingProps {
  guildId: string;
}

function StepVoiceTracking({ guildId }: StepVoiceTrackingProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-4 rounded-xl border border-indigo-100 bg-indigo-50 p-4">
        <Mic className="mt-0.5 h-6 w-6 flex-shrink-0 text-indigo-500" />
        <div>
          <p className="font-medium text-gray-900">자동 활성화됨</p>
          <p className="mt-1 text-sm text-gray-600">
            음성 추적은 봇이 서버에 연결되는 순간 자동으로 시작됩니다. 별도의 활성화 없이 모든
            음성 채널의 입장·퇴장 시간이 기록됩니다.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-700">기록되는 데이터</p>
        {[
          "음성 채널 입장 / 퇴장 시각",
          "채널별 누적 체류 시간",
          "일·주·월 단위 활동 통계",
        ].map((item) => (
          <div key={item} className="flex items-center gap-3 text-sm text-gray-600">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-indigo-400" />
            {item}
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="mb-2 text-sm font-medium text-gray-900">특정 채널을 제외하려면?</p>
        <p className="mb-3 text-sm text-gray-500">
          AFK 채널이나 특정 채널을 추적에서 제외할 수 있습니다.
        </p>
        <Link
          href={`/settings/guild/${guildId}/voice`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
        >
          음성 추적 설정으로 이동
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

interface StepNotificationChannelProps {
  guildId: string;
}

function StepNotificationChannel({ guildId }: StepNotificationChannelProps) {
  const notifications = [
    {
      title: "신입 알림",
      description: "새 멤버 입장 시 환영 메시지와 신입 미션을 전달합니다.",
      href: `/settings/guild/${guildId}/newbie`,
      label: "신입 알림 설정",
    },
    {
      title: "비활동 회원 알림",
      description: "일정 기간 활동이 없는 멤버를 자동으로 분류하고 알림을 보냅니다.",
      href: `/settings/guild/${guildId}/inactive-member`,
      label: "비활동 회원 설정",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50 p-4">
        <Bell className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
        <p className="text-sm text-amber-800">
          알림 채널을 설정하지 않아도 봇은 정상 동작합니다. 필요한 기능만 선택적으로 활성화하세요.
        </p>
      </div>

      {notifications.map((n) => (
        <div
          key={n.title}
          className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
        >
          <p className="mb-1 font-medium text-gray-900">{n.title}</p>
          <p className="mb-3 text-sm text-gray-500">{n.description}</p>
          <Link
            href={n.href}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
          >
            {n.label}
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ))}
    </div>
  );
}

interface StepCompleteProps {
  guildId: string;
}

function StepComplete({ guildId }: StepCompleteProps) {
  const features = [
    {
      href: `/dashboard/guild/${guildId}/overview`,
      label: "서버 개요",
      desc: "활동 요약과 주간 통계를 한눈에 확인합니다",
    },
    {
      href: `/dashboard/guild/${guildId}/voice`,
      label: "음성 활동",
      desc: "멤버별 음성 채널 활동 현황을 조회합니다",
    },
    {
      href: `/dashboard/guild/${guildId}/newbie`,
      label: "신입 관리",
      desc: "신입 멤버 현황과 미션 달성률을 관리합니다",
    },
    {
      href: `/dashboard/guild/${guildId}/inactive-member`,
      label: "비활동 회원",
      desc: "비활동 회원 분류 결과를 확인합니다",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle2 className="h-9 w-9 text-emerald-500" />
        </div>
        <div>
          <p className="text-lg font-semibold text-gray-900">설정 완료!</p>
          <p className="mt-1 text-sm text-gray-500">
            DHyunBot이 서버에서 활동을 추적할 준비가 되었습니다.
          </p>
        </div>
      </div>

      <div>
        <p className="mb-3 text-sm font-medium text-gray-700">주요 기능 바로가기</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {features.map((f) => (
            <Link
              key={f.href}
              href={f.href}
              className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-3 transition-colors hover:border-indigo-200 hover:bg-indigo-50"
            >
              <LayoutDashboard className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">{f.label}</p>
                <p className="text-xs text-gray-500">{f.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── 메인 페이지 ────────────────────────────────────────────────────────────

export default function GettingStartedPage() {
  const params = useParams();
  // Next.js 동적 라우트 세그먼트는 단일 값임이 라우트 정의에 의해 보장된다
  const guildId = params.guildId as string;
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState(1);

  function handleNext() {
    if (currentStep < STEP_COUNT) {
      setCurrentStep((prev) => prev + 1);
    }
  }

  function handlePrev() {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  }

  function handleFinish() {
    router.push(`/dashboard/guild/${guildId}/overview`);
  }

  const currentMeta = STEPS[currentStep - 1];
  const isLastStep = currentStep === STEP_COUNT;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-2xl">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">시작하기</h1>
          <p className="mt-1 text-sm text-gray-500">
            DHyunBot을 처음 사용한다면 아래 단계를 따라 설정하세요.
          </p>
        </div>

        {/* 스텝 인디케이터 */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {STEPS.map((step, idx) => {
              const isCompleted = currentStep > step.id;
              const isActive = currentStep === step.id;

              return (
                <div key={step.id} className="flex flex-1 items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                        isCompleted
                          ? "bg-indigo-600 text-white"
                          : isActive
                            ? "border-2 border-indigo-600 bg-white text-indigo-600"
                            : "border-2 border-gray-200 bg-white text-gray-400"
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <span>{step.id}</span>
                      )}
                    </div>
                    <span
                      className={`mt-1.5 hidden text-xs sm:block ${
                        isActive ? "font-medium text-indigo-600" : "text-gray-400"
                      }`}
                    >
                      {step.title}
                    </span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div
                      className={`mx-1 h-0.5 flex-1 transition-colors sm:mx-2 ${
                        currentStep > step.id ? "bg-indigo-600" : "bg-gray-200"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 스텝 카드 */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
          <div className="mb-6">
            <p className="text-xs font-medium uppercase tracking-wider text-indigo-500">
              {currentStep} / {STEP_COUNT}단계
            </p>
            <h2 className="mt-1 text-xl font-bold text-gray-900">{currentMeta.title}</h2>
            <p className="mt-1 text-sm text-gray-500">{currentMeta.subtitle}</p>
          </div>

          <div className="min-h-[220px]">
            {currentStep === 1 && <StepBotPermission guildId={guildId} />}
            {currentStep === 2 && <StepVoiceTracking guildId={guildId} />}
            {currentStep === 3 && <StepNotificationChannel guildId={guildId} />}
            {currentStep === 4 && <StepComplete guildId={guildId} />}
          </div>

          {/* 네비게이션 버튼 */}
          <div className="mt-8 flex items-center justify-between border-t border-gray-100 pt-6">
            <button
              onClick={handlePrev}
              disabled={currentStep === 1}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
              이전
            </button>

            {isLastStep ? (
              <button
                onClick={handleFinish}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
              >
                대시보드로 이동
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
              >
                다음
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
