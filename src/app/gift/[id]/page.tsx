"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { fetchGiftOfferPublic, markGiftOpened, markGiftAccepted } from "@/lib/supabase/db";
import type { GiftOffer } from "@/types";

/* ─── confetti particle ─── */
interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  rotation: number;
  delay: number;
  duration: number;
}

function generateParticles(count: number): Particle[] {
  const colors = ["#FFD700", "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE"];
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: -(Math.random() * 20 + 5),
    color: colors[Math.floor(Math.random() * colors.length)],
    size: Math.random() * 8 + 4,
    rotation: Math.random() * 360,
    delay: Math.random() * 2,
    duration: Math.random() * 2 + 3,
  }));
}

/* ─── sparkle ─── */
function Sparkles({ count = 20 }: { count?: number }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="absolute animate-ping"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 3}s`,
            animationDuration: `${Math.random() * 2 + 1}s`,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M6 0L7.5 4.5L12 6L7.5 7.5L6 12L4.5 7.5L0 6L4.5 4.5Z" fill="#FFD700" opacity="0.7" />
          </svg>
        </div>
      ))}
    </div>
  );
}

/* ─── confetti ─── */
function Confetti({ particles }: { particles: Particle[] }) {
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute animate-confetti"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size * 0.6,
            backgroundColor: p.color,
            transform: `rotate(${p.rotation}deg)`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            borderRadius: "1px",
          }}
        />
      ))}
    </div>
  );
}

/* ─── box colors ─── */
const BOX_THEMES: Record<string, { bg: string; lid: string; ribbon: string; glow: string; accent: string }> = {
  purple: {
    bg: "from-purple-600 to-purple-800",
    lid: "from-purple-500 to-purple-700",
    ribbon: "bg-yellow-400",
    glow: "shadow-[0_0_80px_rgba(168,85,247,0.4)]",
    accent: "text-purple-400",
  },
  gold: {
    bg: "from-yellow-500 to-amber-700",
    lid: "from-yellow-400 to-amber-600",
    ribbon: "bg-red-500",
    glow: "shadow-[0_0_80px_rgba(245,158,11,0.4)]",
    accent: "text-amber-400",
  },
  red: {
    bg: "from-red-500 to-red-800",
    lid: "from-red-400 to-red-700",
    ribbon: "bg-white",
    glow: "shadow-[0_0_80px_rgba(239,68,68,0.4)]",
    accent: "text-red-400",
  },
  emerald: {
    bg: "from-emerald-500 to-emerald-800",
    lid: "from-emerald-400 to-emerald-700",
    ribbon: "bg-yellow-300",
    glow: "shadow-[0_0_80px_rgba(16,185,129,0.4)]",
    accent: "text-emerald-400",
  },
  blue: {
    bg: "from-blue-500 to-blue-800",
    lid: "from-blue-400 to-blue-700",
    ribbon: "bg-white",
    glow: "shadow-[0_0_80px_rgba(59,130,246,0.4)]",
    accent: "text-blue-400",
  },
};

/* ─── page ─── */
export default function GiftPage() {
  const params = useParams();
  const id = params.id as string;

  const [gift, setGift] = useState<GiftOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [stage, setStage] = useState<"box" | "opening" | "revealed" | "accepted">("box");
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    fetchGiftOfferPublic(id)
      .then((data) => {
        if (!data) { setNotFound(true); return; }
        setGift(data);
        if (data.status === "accepted") setStage("accepted");
        else if (data.status === "opened") setStage("revealed");
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  const handleOpenBox = useCallback(async () => {
    if (stage !== "box") return;
    setStage("opening");
    if (gift && gift.status === "pending") {
      markGiftOpened(gift.id);
    }
    setTimeout(() => {
      setStage("revealed");
      setParticles(generateParticles(80));
    }, 1500);
  }, [stage, gift]);

  const handleAccept = useCallback(async () => {
    if (!gift) return;
    await markGiftAccepted(gift.id);
    setStage("accepted");
    setParticles(generateParticles(120));
  }, [gift]);

  const theme = BOX_THEMES[gift?.box_color || "purple"] || BOX_THEMES.purple;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B1120] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !gift) {
    return (
      <div className="min-h-screen bg-[#0B1120] flex items-center justify-center" dir="rtl">
        <div className="text-center space-y-4">
          <div className="text-6xl">😔</div>
          <h1 className="text-xl font-bold text-white">الرابط غير صالح</h1>
          <p className="text-gray-400 text-sm">هذه الهدية غير موجودة أو منتهية الصلاحية</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1120] flex flex-col items-center justify-center relative overflow-hidden" dir="rtl">
      {/* Background effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-amber-600/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-fuchsia-600/5 rounded-full blur-[150px]" />
      </div>

      {/* Confetti */}
      {particles.length > 0 && <Confetti particles={particles} />}

      {/* Stars background */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 40 }, (_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              opacity: Math.random() * 0.5 + 0.1,
            }}
          />
        ))}
      </div>

      {/* Greeting */}
      <div className="relative z-10 text-center mb-8">
        <p className="text-gray-400 text-sm mb-1">مرحباً</p>
        <h1 className="text-2xl md:text-3xl font-bold text-white">{gift.client_name}</h1>
        {stage === "box" && (
          <p className="text-gray-400 text-sm mt-2 animate-pulse">لديك هدية خاصة! اضغط على الصندوق لفتحها</p>
        )}
      </div>

      {/* Gift Box - Pre-open state */}
      {(stage === "box" || stage === "opening") && (
        <div className="relative z-10">
          <button
            onClick={handleOpenBox}
            disabled={stage === "opening"}
            className={`relative group transition-all duration-500 ${stage === "opening" ? "scale-110" : "hover:scale-105 active:scale-95"}`}
          >
            {/* Glow effect */}
            <div className={`absolute -inset-8 rounded-3xl ${theme.glow} opacity-60 group-hover:opacity-100 transition-opacity`} />

            {/* Sparkles around box */}
            {stage === "box" && <Sparkles count={15} />}

            {/* Box container */}
            <div className="relative w-52 h-52 md:w-64 md:h-64">
              {/* Box base */}
              <div className={`absolute bottom-0 left-0 right-0 h-[60%] bg-gradient-to-b ${theme.bg} rounded-2xl shadow-2xl`}>
                {/* Vertical ribbon */}
                <div className={`absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-6 ${theme.ribbon} opacity-80`} />
              </div>

              {/* Box lid */}
              <div
                className={`absolute top-[15%] left-[-5%] right-[-5%] h-[30%] bg-gradient-to-b ${theme.lid} rounded-xl shadow-lg transition-all duration-1000 origin-bottom
                ${stage === "opening" ? "-translate-y-24 -rotate-[60deg] opacity-0" : ""}`}
              >
                {/* Horizontal ribbon on lid */}
                <div className={`absolute top-1/2 -translate-y-1/2 left-0 right-0 h-6 ${theme.ribbon} opacity-80`} />
                {/* Ribbon bow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[120%]">
                  <div className={`w-16 h-10 ${theme.ribbon} rounded-full opacity-90`} />
                  <div className={`absolute top-1 left-1/2 -translate-x-1/2 w-4 h-4 ${theme.ribbon} rounded-full opacity-100 ring-2 ring-white/20`} />
                </div>
              </div>

              {/* Emoji inside box - visible when opening */}
              {stage === "opening" && (
                <div className="absolute top-[15%] left-1/2 -translate-x-1/2 text-6xl animate-bounce">
                  {gift.gift_emoji || "🎁"}
                </div>
              )}
            </div>

            {/* Tap indicator */}
            {stage === "box" && (
              <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-2">
                <span className="block w-8 h-8 border-2 border-white/30 rounded-full animate-ping" />
                <span className="text-white/50 text-xs">اضغط لفتح الهدية</span>
              </div>
            )}
          </button>
        </div>
      )}

      {/* Revealed Gift */}
      {(stage === "revealed" || stage === "accepted") && (
        <div className="relative z-10 w-full max-w-md mx-auto px-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <Sparkles count={25} />

          <div className={`relative bg-[#111827]/90 backdrop-blur-xl rounded-3xl border border-white/10 p-8 text-center ${theme.glow}`}>
            {/* Emoji */}
            <div className="text-7xl mb-4 animate-bounce">{gift.gift_emoji || "🎁"}</div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-white mb-2">{gift.gift_title}</h2>

            {/* Value badge */}
            {gift.gift_value && (
              <div className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-l ${theme.bg} text-white font-bold text-lg mb-4`}>
                {gift.gift_value}
              </div>
            )}

            {/* Description */}
            {gift.gift_description && (
              <p className="text-gray-300 text-sm leading-relaxed mb-6">{gift.gift_description}</p>
            )}

            {/* Buttons */}
            {stage === "revealed" && (
              <div className="space-y-3">
                <button
                  onClick={handleAccept}
                  className={`w-full py-4 rounded-2xl bg-gradient-to-l ${theme.bg} text-white font-bold text-lg hover:opacity-90 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl`}
                >
                  قبول الهدية 🎉
                </button>
                <p className="text-gray-500 text-xs">بالضغط على قبول، سيتم تفعيل العرض لحسابك</p>
              </div>
            )}

            {/* Accepted state */}
            {stage === "accepted" && (
              <div className="space-y-4">
                <div className="w-20 h-20 mx-auto bg-emerald-500/20 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-emerald-400">تم قبول الهدية بنجاح!</h3>
                <p className="text-gray-400 text-sm">سيتم التواصل معك قريباً لتفعيل العرض</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="relative z-10 mt-12 text-center">
        <p className="text-gray-600 text-xs">مدير بلاس — نهتم بعملائنا</p>
      </div>

      {/* CSS animations */}
      <style jsx global>{`
        @keyframes confetti {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .animate-confetti {
          animation: confetti linear forwards;
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-in {
          animation: fadeInUp 0.7s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
