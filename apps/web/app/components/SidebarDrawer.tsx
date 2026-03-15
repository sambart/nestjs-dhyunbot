"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

import { useSidebar } from "./SidebarContext";

interface SidebarDrawerProps {
  children: React.ReactNode;
}

export default function SidebarDrawer({ children }: SidebarDrawerProps) {
  const { isOpen, close } = useSidebar();

  // body 스크롤 방지
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      {/* 데스크톱: 고정 사이드바 */}
      <aside className="hidden md:block w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-4rem)]">
        {children}
      </aside>

      {/* 모바일: 오버레이 Drawer */}
      <div
        className={`fixed inset-0 z-40 md:hidden transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* 백드롭 */}
        <div className="absolute inset-0 bg-black/50" onClick={close} />

        {/* Drawer 패널 */}
        <aside
          className={`absolute top-0 left-0 h-full w-64 bg-white shadow-xl transition-transform duration-300 ${
            isOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <span className="font-semibold text-gray-900">메뉴</span>
            <button
              onClick={close}
              className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          {children}
        </aside>
      </div>
    </>
  );
}
