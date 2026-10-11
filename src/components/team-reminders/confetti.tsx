"use client";

import { useMemo } from "react";

const COLORS = ["#FFD700", "#FF6B6B", "#4ECDC4", "#A78BFA", "#96E6A1", "#F472B6", "#FDBA74", "#60A5FA"];

/** قصاصات احتفال خفيفة بدون مكتبات — تُعرض فوق الشاشة ولا تمنع الضغط */
export function Confetti({ count = 50 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        duration: 2.2 + Math.random() * 1.8,
        size: 6 + Math.random() * 6,
        rotate: Math.random() * 360,
        color: COLORS[i % COLORS.length],
        round: i % 3 === 0,
      })),
    [count]
  );
  return (
    <div className="pointer-events-none fixed inset-0 z-[120] overflow-hidden" aria-hidden>
      <style>{`
        @keyframes trConfettiFall { 0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; } 100% { transform: translateY(110vh) rotate(720deg); opacity: 0; } }
      `}</style>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-0"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.round ? p.size : p.size * 1.6,
            backgroundColor: p.color,
            borderRadius: p.round ? "50%" : 2,
            transform: `rotate(${p.rotate}deg)`,
            animation: `trConfettiFall ${p.duration}s cubic-bezier(0.25,0.46,0.45,0.94) ${p.delay}s forwards`,
          }}
        />
      ))}
    </div>
  );
}
