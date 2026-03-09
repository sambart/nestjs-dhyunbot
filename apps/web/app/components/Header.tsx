"use client";

import { Home, LayoutDashboard, Menu, Settings, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export interface Guild {
  id: string;
  name: string;
  icon: string | null;
}

export interface User {
  discordId: string;
  username: string;
  avatar: string | null;
  guilds: Guild[];
}

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const handleLogin = useCallback(() => {
    window.location.href = "/auth/discord";
  }, []);

  const handleLogout = useCallback(async () => {
    await fetch("/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  }, []);

  const avatarUrl = user?.avatar
    ? `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png`
    : null;

  const displayInitial = user?.username?.charAt(0).toUpperCase() ?? "U";

  return (
    <>
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* 왼쪽: 로고 + 네비게이션 */}
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">D</span>
              </div>
              <span className="font-bold text-xl text-gray-900 hidden sm:block">
                Dhyunbot
              </span>
            </Link>

            <div className="hidden md:flex items-center space-x-4">
              <Link
                href="/"
                className="flex items-center space-x-2 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <Home className="w-4 h-4" />
                <span>홈</span>
              </Link>

              <Link
                href={user ? "/select-guild?mode=dashboard" : "/auth/discord"}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>대시보드</span>
              </Link>

              {user && (
                <Link
                  href="/select-guild"
                  className="flex items-center space-x-2 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  <span>설정</span>
                </Link>
              )}
            </div>
          </div>

          {/* 오른쪽: 로그인/사용자 정보 */}
          <div className="hidden md:flex items-center space-x-4">
            {isLoading ? (
              <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
            ) : user ? (
              <>
                <div className="flex items-center space-x-3">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={user.username}
                      width={32}
                      height={32}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                      <span className="text-indigo-600 text-sm font-semibold">
                        {displayInitial}
                      </span>
                    </div>
                  )}
                  <span className="text-sm text-gray-700">{user.username}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                  로그아웃
                </button>
              </>
            ) : (
              <button
                onClick={handleLogin}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
              >
                로그인
              </button>
            )}
          </div>

          {/* 모바일 메뉴 버튼 */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100"
          >
            {isMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* 모바일 메뉴 */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200">
            <div className="flex flex-col space-y-2">
              <Link
                href="/"
                className="flex items-center space-x-2 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100"
                onClick={() => setIsMenuOpen(false)}
              >
                <Home className="w-4 h-4" />
                <span>홈</span>
              </Link>

              <Link
                href={user ? "/select-guild?mode=dashboard" : "/auth/discord"}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100"
                onClick={() => setIsMenuOpen(false)}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>대시보드</span>
              </Link>

              {user && (
                <Link
                  href="/select-guild"
                  className="flex items-center space-x-2 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Settings className="w-4 h-4" />
                  <span>설정</span>
                </Link>
              )}

              <div className="pt-4 border-t border-gray-200">
                {user ? (
                  <button
                    onClick={() => {
                      handleLogout();
                      setIsMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-gray-700 hover:bg-gray-100 rounded-lg"
                  >
                    로그아웃
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      handleLogin();
                      setIsMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    로그인
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>

    {/* Toast */}
    {toast && (
      <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] bg-gray-800 text-white px-5 py-3 rounded-lg shadow-lg text-sm animate-fade-in">
        {toast}
      </div>
    )}
  </>
  );
}
