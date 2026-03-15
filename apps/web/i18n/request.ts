import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

import { defaultLocale, type Locale, LOCALE_COOKIE, locales } from './config';

function negotiateLocale(acceptLanguage: string): Locale {
  const segments = acceptLanguage.split(',');
  for (const segment of segments) {
    const lang = segment.split(';')[0].trim().toLowerCase();
    const prefix = lang.slice(0, 2);
    if (locales.includes(prefix as Locale)) return prefix as Locale;
  }
  return defaultLocale;
}

async function loadMessages(locale: Locale) {
  return {
    common: (await import(`@dhyunbot/i18n/locales/${locale}/web/common.json`)).default,
    landing: (await import(`@dhyunbot/i18n/locales/${locale}/web/landing.json`)).default,
    dashboard: (await import(`@dhyunbot/i18n/locales/${locale}/web/dashboard.json`)).default,
    settings: (await import(`@dhyunbot/i18n/locales/${locale}/web/settings.json`)).default,
    auth: (await import(`@dhyunbot/i18n/locales/${locale}/web/auth.json`)).default,
  };
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;

  if (cookieLocale && locales.includes(cookieLocale as Locale)) {
    const locale = cookieLocale as Locale;
    return { locale, messages: await loadMessages(locale) };
  }

  const headerStore = await headers();
  const acceptLang = headerStore.get('accept-language') ?? '';
  const detected = negotiateLocale(acceptLang);

  return { locale: detected, messages: await loadMessages(detected) };
});
