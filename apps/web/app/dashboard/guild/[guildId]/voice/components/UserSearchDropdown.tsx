"use client";

import { useEffect, useRef, useState } from "react";

import type { MemberSearchResult } from "@/app/lib/user-detail-api";
import { searchMembers } from "@/app/lib/user-detail-api";

interface Props {
  guildId: string;
  onSelect: (userId: string) => void;
}

const DEBOUNCE_MS = 300;

export default function UserSearchDropdown({ guildId, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MemberSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
        setIsOpen(data.length > 0);
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
      setIsOpen(false);
    }
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  function handleSelect(result: MemberSearchResult) {
    setIsOpen(false);
    setQuery("");
    onSelect(result.userId);
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
      {isOpen && results.length > 0 && (
        <ul className="absolute left-0 top-full z-50 mt-1 w-full rounded-lg border border-border bg-background shadow-md">
          {results.map((result) => (
            <li
              key={result.userId}
              className="cursor-pointer px-3 py-2 text-sm hover:bg-muted"
              onClick={() => handleSelect(result)}
            >
              <span className="font-medium">{result.userName}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                {result.userId}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
