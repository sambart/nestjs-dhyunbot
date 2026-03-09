"use client";

import { Search } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { MemberSearchResult } from "@/app/lib/user-detail-api";
import { searchMembers } from "@/app/lib/user-detail-api";

const DEBOUNCE_MS = 300;

export default function UserSearchPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MemberSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const trimmedQuery = query.trim();

  useEffect(() => {
    if (!trimmedQuery) {
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      const data = await searchMembers(guildId, trimmedQuery);
      if (!cancelled) {
        setResults(data);
        setLoading(false);
        setSearched(true);
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [guildId, trimmedQuery]);

  function handleQueryChange(value: string) {
    setQuery(value);
    if (!value.trim()) {
      setResults([]);
      setSearched(false);
      setLoading(false);
    } else {
      setLoading(true);
    }
  }

  function handleSelect(result: MemberSearchResult) {
    router.push(`/dashboard/guild/${guildId}/user/${result.userId}`);
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">유저 검색</h1>

      {/* 검색 입력 */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="닉네임 또는 디스코드 ID로 검색..."
          className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/50"
        />
      </div>

      {/* 검색 결과 */}
      {loading && (
        <div className="text-sm text-muted-foreground">검색 중...</div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="text-sm text-muted-foreground">
          검색 결과가 없습니다.
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="max-w-md divide-y divide-border rounded-lg border border-border">
          {results.map((result) => (
            <div
              key={result.userId}
              className="flex cursor-pointer items-center justify-between px-4 py-3 transition-colors hover:bg-muted/50"
              onClick={() => handleSelect(result)}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100">
                  <span className="text-sm font-semibold text-indigo-600">
                    {result.userName.charAt(0)}
                  </span>
                </div>
                <span className="text-sm font-medium">{result.userName}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {result.userId}
              </span>
            </div>
          ))}
        </div>
      )}

      {!searched && !loading && (
        <div className="text-sm text-muted-foreground">
          음성 활동 기록이 있는 유저를 닉네임으로 검색할 수 있습니다.
        </div>
      )}
    </div>
  );
}
