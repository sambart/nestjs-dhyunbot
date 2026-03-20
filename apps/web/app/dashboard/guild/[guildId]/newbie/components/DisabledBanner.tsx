'use client';

import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

interface DisabledBannerProps {
  featureName: string;
  settingsUrl: string;
}

export default function DisabledBanner({ featureName, settingsUrl }: DisabledBannerProps) {
  const t = useTranslations('dashboard');

  return (
    <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
      <span>
        {t('newbie.disabledBanner', { featureName })}
      </span>
      <Link
        href={settingsUrl}
        className="ml-auto flex-shrink-0 text-xs font-medium text-amber-700 underline hover:text-amber-900"
      >
        {t('newbie.goToSettingsLink')}
      </Link>
    </div>
  );
}
