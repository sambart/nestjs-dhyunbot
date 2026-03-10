'use client';

import { ChevronDown } from 'lucide-react';
import { type ReactNode, useState } from 'react';

interface CollapsibleSectionProps {
  /** 섹션 제목 */
  title: string;
  /** 접힌 상태에서 표시할 요약 (ReactNode 허용) */
  summary?: ReactNode;
  /** 기본 펼침 여부 */
  defaultOpen?: boolean;
  /** 자식 콘텐츠 */
  children: ReactNode;
}

export default function CollapsibleSection({
  title,
  summary,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-semibold text-gray-900">{title}</span>
          {!isOpen && summary && (
            <span className="text-xs text-gray-500 truncate">{summary}</span>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      {isOpen && <div className="px-4 py-4 space-y-5">{children}</div>}
    </div>
  );
}
