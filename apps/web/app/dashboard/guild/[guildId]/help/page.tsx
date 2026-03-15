"use client";

import { ChevronDown, ChevronUp, HelpCircle } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";

// ─── 타입 ────────────────────────────────────────────────────────────────────

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqSection {
  id: string;
  title: string;
  items: FaqItem[];
}

// ─── FAQ 데이터 ──────────────────────────────────────────────────────────────

const FAQ_SECTIONS: FaqSection[] = [
  {
    id: "voice",
    title: "음성 활동 추적",
    items: [
      {
        question: "어떤 데이터가 기록되나요?",
        answer:
          "멤버가 음성 채널에 입장한 시각, 퇴장한 시각, 그리고 채널별 누적 체류 시간이 기록됩니다. 서버 내 모든 음성 채널이 기본적으로 추적 대상이며, 음소거·영상 상태는 기록하지 않습니다.",
      },
      {
        question: "제외 채널은 어떻게 설정하나요?",
        answer:
          "설정 → 음성 추적 메뉴에서 추적에서 제외할 채널을 선택할 수 있습니다. AFK 채널이나 관리자 전용 채널처럼 기록이 불필요한 채널을 제외하는 데 활용하세요.",
      },
    ],
  },
  {
    id: "gemini",
    title: "AI 분석 (Gemini)",
    items: [
      {
        question: "Gemini AI 분석은 어떻게 사용하나요?",
        answer:
          "디스코드 내에서 슬래시 커맨드를 사용합니다. 봇이 지난 7일간의 음성 활동 데이터를 분석해 서버의 활성 시간대, 주요 참여자, 활동 트렌드 등을 요약한 리포트를 생성합니다.",
      },
      {
        question: "슬래시 커맨드는 무엇인가요?",
        answer:
          "/voice-report 커맨드를 입력하면 AI 분석 리포트가 생성됩니다. 리포트 생성에는 최대 10초 정도 소요될 수 있습니다. 관리자 권한이 있는 멤버만 사용할 수 있습니다.",
      },
    ],
  },
  {
    id: "newbie",
    title: "신입 관리",
    items: [
      {
        question: "미션은 어떻게 만드나요?",
        answer:
          "설정 → 신입 관리 메뉴에서 신입 멤버에게 부여할 미션 목록을 구성할 수 있습니다. 미션 유형(음성 채널 참여, 메시지 전송 등), 목표치, 완료 보상 역할을 설정합니다. 설정 후 입장하는 신규 멤버에게 자동으로 미션이 부여됩니다.",
      },
      {
        question: "모코코 사냥이란?",
        answer:
          "신입 미션 완료 후 일정 기간이 지나도 서버에서 활동하지 않는 멤버를 식별하는 기능입니다. '서버만 가입하고 실제로 참여하지 않는 유령 회원'을 정리하는 데 활용됩니다.",
      },
    ],
  },
  {
    id: "inactive",
    title: "비활동 회원",
    items: [
      {
        question: "비활동 분류 기준은 무엇인가요?",
        answer:
          "설정에서 지정한 기간(기본 30일) 동안 음성 채널 활동이 없는 멤버가 비활동으로 분류됩니다. 등급은 설정한 기준에 따라 경고·주의·비활동으로 나뉩니다.",
      },
      {
        question: "자동 조치는 어떻게 동작하나요?",
        answer:
          "비활동 회원 분류 주기(기본 매주)에 맞춰 봇이 자동으로 분류를 실행합니다. 분류 후 지정된 채널에 결과를 알리거나, 특정 역할을 부여하거나 제거하는 자동 조치를 설정할 수 있습니다. 실제 추방은 자동으로 이루어지지 않으며 관리자가 직접 수행해야 합니다.",
      },
    ],
  },
  {
    id: "co-presence",
    title: "관계 분석 (동시 접속)",
    items: [
      {
        question: "친밀도 점수는 어떻게 계산되나요?",
        answer:
          "두 멤버가 같은 음성 채널에 동시에 접속해 있던 누적 시간을 기반으로 점수를 산출합니다. 함께 보낸 시간이 길수록 친밀도 점수가 높아집니다. 관계 분석 그래프에서 멤버 간의 연결 강도를 시각적으로 확인할 수 있습니다.",
      },
    ],
  },
  {
    id: "auto-channel",
    title: "자동 채널 생성",
    items: [
      {
        question: "트리거 채널 설정법은?",
        answer:
          "설정 → 자동 채널 메뉴에서 트리거 채널을 지정합니다. 멤버가 트리거 채널에 입장하면 봇이 자동으로 새 음성 채널을 생성하고 해당 멤버를 이동시킵니다. 채널이 비워지면 자동으로 삭제됩니다.",
      },
    ],
  },
];

// ─── 아코디언 아이템 컴포넌트 ────────────────────────────────────────────────

interface AccordionItemProps {
  item: FaqItem;
  isOpen: boolean;
  onToggle: () => void;
}

function AccordionItem({ item, isOpen, onToggle }: AccordionItemProps) {
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-gray-50"
      >
        <span className="text-sm font-medium text-gray-800">{item.question}</span>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 flex-shrink-0 text-indigo-400" />
        ) : (
          <ChevronDown className="h-4 w-4 flex-shrink-0 text-gray-400" />
        )}
      </button>
      {isOpen && (
        <div className="px-5 pb-5">
          <p className="text-sm leading-relaxed text-gray-600">{item.answer}</p>
        </div>
      )}
    </div>
  );
}

// ─── 섹션 컴포넌트 ────────────────────────────────────────────────────────────

interface FaqSectionCardProps {
  section: FaqSection;
}

function FaqSectionCard({ section }: FaqSectionCardProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  function handleToggle(idx: number) {
    setOpenIndex((prev) => (prev === idx ? null : idx));
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 bg-gray-50 px-5 py-3">
        <h2 className="text-sm font-semibold text-gray-900">{section.title}</h2>
      </div>
      <div>
        {section.items.map((item, idx) => (
          <AccordionItem
            key={item.question}
            item={item}
            isOpen={openIndex === idx}
            onToggle={() => handleToggle(idx)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── 메인 페이지 ────────────────────────────────────────────────────────────

export default function HelpPage() {
  // guildId는 향후 서버별 도움말 컨텍스트에 활용 가능
  const params = useParams();
  // Next.js 동적 라우트 세그먼트는 단일 값임이 라우트 정의에 의해 보장된다
  void (params.guildId as string);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-2xl">
        {/* 헤더 */}
        <div className="mb-8 flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-50">
            <HelpCircle className="h-5 w-5 text-indigo-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">도움말</h1>
            <p className="mt-1 text-sm text-gray-500">
              DHyunBot의 주요 기능에 대해 자주 묻는 질문을 모았습니다.
            </p>
          </div>
        </div>

        {/* FAQ 섹션 목록 */}
        <div className="space-y-4">
          {FAQ_SECTIONS.map((section) => (
            <FaqSectionCard key={section.id} section={section} />
          ))}
        </div>

        {/* 추가 문의 안내 */}
        <div className="mt-8 rounded-xl border border-indigo-100 bg-indigo-50 p-5 text-center">
          <p className="text-sm font-medium text-indigo-900">더 궁금한 점이 있으신가요?</p>
          <p className="mt-1 text-sm text-indigo-700">
            디스코드 서버에서{" "}
            <code className="rounded bg-indigo-100 px-1.5 py-0.5 font-mono text-xs">
              /help
            </code>{" "}
            커맨드를 입력하거나 관리자에게 문의하세요.
          </p>
        </div>
      </div>
    </div>
  );
}
