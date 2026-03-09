"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { MemberSearchResult } from "@/app/lib/user-detail-api";
import { searchMembers } from "@/app/lib/user-detail-api";

interface Props {
  guildId: string;
  currentUserId: string;
}

const DEBOUNCE_MS = 300;

export default function UserSearchDropdown({ guildId, currentUserId }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MemberSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // debounce 검색
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
        setOpen(data.length > 0);
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
      setOpen(false);
    }
  }

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  function handleSelect(result: MemberSearchResult) {
    setOpen(false);
    setQuery("");
    router.push(`/dashboard/guild/${guildId}/user/${result.userId}`);
  }

  return (
    <div ref={containerRef} className="relative w-64">
      <input
        type="text"
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        placeholder="유저 검색..."
        className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/50"
      />
      {open && results.length > 0 && (
        <ul className="absolute left-0 top-full z-50 mt-1 w-full rounded-lg border border-border bg-background shadow-md">
          {results.map((result) => (
            <li
              key={result.userId}
              className="cursor-pointer px-3 py-2 text-sm hover:bg-muted"
              onClick={() => handleSelect(result)}
            >
              <span className="font-medium">{result.userName}</span>
              {result.userId !== currentUserId && (
                <span className="ml-2 text-xs text-muted-foreground">
                  {result.userId}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
