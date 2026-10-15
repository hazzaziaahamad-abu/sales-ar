"use client";

import { Brain } from "lucide-react";

interface AIChatFABProps {
  onClick: () => void;
  hasUnread?: boolean;
}

export function AIChatFAB({ onClick, hasUnread }: AIChatFABProps) {
  return (
    <button
      onClick={onClick}
      aria-label="المساعد الذكي"
      // الجوال/التابلت: زاوية الشاشة السفلية اليسرى (بدون الشريط الجانبي). الشاشات الكبيرة: جنب الشريط الجانبي.
      className="fixed left-4 lg:left-auto lg:right-[280px] z-50 w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-gradient-to-br from-cyan to-cc-purple shadow-lg shadow-cyan/25 flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
    >
      <Brain className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
      {hasUnread && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-cc-red rounded-full border-2 border-background" />
      )}
    </button>
  );
}
