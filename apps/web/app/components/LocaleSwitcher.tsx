"use client";

import { Globe } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useCallback, useState } from "react";

const LOCALE_LABELS: Record<string, string> = {
  ko: "한국어",
  en: "English",
};

export default function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const handleChange = useCallback(
    (newLocale: string) => {
      document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=31536000;samesite=lax`;
      setIsOpen(false);
      router.refresh();
    },
    [router],
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Globe className="w-4 h-4" />
        <span>{LOCALE_LABELS[locale] ?? locale}</span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-1 w-32 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
            {Object.entries(LOCALE_LABELS).map(([code, label]) => (
              <button
                key={code}
                type="button"
                onClick={() => handleChange(code)}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  code === locale
                    ? "bg-indigo-50 text-indigo-700 font-medium"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
