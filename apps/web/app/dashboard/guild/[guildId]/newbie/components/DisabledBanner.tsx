'use client';

import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';

interface DisabledBannerProps {
  featureName: string;
  settingsUrl: string;
}

export default function DisabledBanner({ featureName, settingsUrl }: DisabledBannerProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
      <span>
        <span className="font-medium">{featureName}</span> 기능이 비활성화 상태입니다. 데이터는 읽기 전용으로 조회할 수 있습니다.
      </span>
      <Link
        href={settingsUrl}
        className="ml-auto flex-shrink-0 text-xs font-medium text-amber-700 underline hover:text-amber-900"
      >
        설정으로 이동
      </Link>
    </div>
  );
}
