'use client';

import { Bot, Hash, Loader2, Mic, Music } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import type { SlashCommand } from '../../../lib/discord-api';
import { fetchGuildCommands } from '../../../lib/discord-api';
import { useSettings } from '../../SettingsContext';

function getCommandIcon(name: string): React.ElementType {
  if (['play', 'stop', 'skip'].includes(name)) return Music;
  if (name.startsWith('voice-') || name === 'my-voice-stats') return Mic;
  if (name === 'community-health') return Bot;
  return Hash;
}

export default function SettingsPage() {
  const { selectedGuildId } = useSettings();
  const [commands, setCommands] = useState<SlashCommand[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const t = useTranslations('settings');

  useEffect(() => {
    if (!selectedGuildId) return;

    Promise.resolve()
      .then(() => {
        setIsLoading(true);
        return fetchGuildCommands(selectedGuildId);
      })
      .then(setCommands)
      .finally(() => setIsLoading(false));
  }, [selectedGuildId]);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('general.title')}</h1>

      {/* 봇 정보 */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('general.botInfo')}</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div className="flex items-center space-x-3">
              <Hash className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-700">{t('general.commandPrefix')}</span>
            </div>
            <span className="text-sm font-mono bg-gray-100 px-3 py-1 rounded">
              !
            </span>
          </div>
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center space-x-3">
              <Bot className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-700">{t('general.registeredCommands')}</span>
            </div>
            <span className="text-sm text-gray-500">
              {isLoading ? '—' : t('general.commandCount', { count: commands.length })}
            </span>
          </div>
        </div>
      </section>

      {/* 슬래시 커맨드 목록 */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {t('general.slashCommands')}
        </h2>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
          </div>
        ) : commands.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-400">{t('general.noSlashCommands')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {commands.map((cmd) => {
              const Icon = getCommandIcon(cmd.name);
              return (
                <div
                  key={cmd.id}
                  className="flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Icon className="w-4 h-4 text-indigo-500" />
                  <span className="text-sm font-mono font-medium text-gray-900">
                    /{cmd.name}
                  </span>
                  <span className="text-sm text-gray-500">{cmd.description}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
