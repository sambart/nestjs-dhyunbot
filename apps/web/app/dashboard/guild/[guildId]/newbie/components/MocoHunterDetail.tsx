'use client';

import { useCallback, useEffect, useState } from 'react';

import type { MocoNewbieDetail } from '../../../../../lib/newbie-dashboard-api';
import { fetchMocoHunterDetail } from '../../../../../lib/newbie-dashboard-api';

interface MocoHunterDetailProps {
  guildId: string;
  hunterId: string;
  colSpan: number;
}

export default function MocoHunterDetail({ guildId, hunterId, colSpan }: MocoHunterDetailProps) {
  const [newbies, setNewbies] = useState<MocoNewbieDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchMocoHunterDetail(guildId, hunterId);
      setNewbies(res.newbies);
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터를 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [guildId, hunterId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  return (
    <tr>
      <td colSpan={colSpan} className="bg-indigo-50 px-6 py-4">
        {isLoading ? (
          <div className="text-sm text-gray-500">불러오는 중...</div>
        ) : error ? (
          <div className="text-sm text-red-500">{error}</div>
        ) : newbies.length === 0 ? (
          <div className="text-sm text-gray-400">도움받은 모코코가 없습니다.</div>
        ) : (
          <div>
            <p className="mb-2 text-xs font-semibold text-indigo-700">도움받은 모코코 목록</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-indigo-200">
                  <th className="pb-1 pr-4 text-left text-xs font-medium text-gray-500">닉네임</th>
                  <th className="pb-1 pr-4 text-right text-xs font-medium text-gray-500">동시접속 시간</th>
                  <th className="pb-1 text-right text-xs font-medium text-gray-500">세션 횟수</th>
                </tr>
              </thead>
              <tbody>
                {newbies.map((nb) => (
                  <tr key={nb.newbieId} className="border-b border-indigo-100 last:border-0">
                    <td className="py-1 pr-4 text-gray-800">{nb.newbieName}</td>
                    <td className="py-1 pr-4 text-right text-gray-600 tabular-nums">{nb.minutes}분</td>
                    <td className="py-1 text-right text-gray-600 tabular-nums">{nb.sessions}회</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </td>
    </tr>
  );
}
