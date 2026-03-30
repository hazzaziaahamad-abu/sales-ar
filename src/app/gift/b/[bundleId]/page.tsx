"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { fetchGiftBundle, markGiftOpened, markGiftAccepted } from "@/lib/supabase/db";
import type { GiftOffer } from "@/types";

/* ─── confetti ─── */
interface Particle {
  id: number; x: number; color: string; size: number; rotation: number; delay: number; duration: number;
}
function genParticles(n: number): Particle[] {
  const c = ["#FFD700","#FF6B6B","#4ECDC4","#45B7D1","#96CEB4","#FFEAA7","#DDA0DD","#F7DC6F","#BB8FCE","#E74C3C"];
  return Array.from({length:n},(_,i)=>({id:i,x:Math.random()*100,color:c[i%c.length],size:Math.random()*8+4,rotation:Math.random()*360,delay:Math.random()*2,duration:Math.random()*2+3}));
}

const BOX_THEMES: Record<string,{bg:string;lid:string;ribbon:string;glow:string}> = {
  purple:{bg:"from-purple-600 to-purple-800",lid:"from-purple-500 to-purple-700",ribbon:"bg-yellow-400",glow:"shadow-[0_0_80px_rgba(168,85,247,0.4)]"},
  gold:{bg:"from-yellow-500 to-amber-700",lid:"from-yellow-400 to-amber-600",ribbon:"bg-red-500",glow:"shadow-[0_0_80px_rgba(245,158,11,0.4)]"},
  red:{bg:"from-red-500 to-red-800",lid:"from-red-400 to-red-700",ribbon:"bg-white",glow:"shadow-[0_0_80px_rgba(239,68,68,0.4)]"},
  emerald:{bg:"from-emerald-500 to-emerald-800",lid:"from-emerald-400 to-emerald-700",ribbon:"bg-yellow-300",glow:"shadow-[0_0_80px_rgba(16,185,129,0.4)]"},
  blue:{bg:"from-blue-500 to-blue-800",lid:"from-blue-400 to-blue-700",ribbon:"bg-white",glow:"shadow-[0_0_80px_rgba(59,130,246,0.4)]"},
};

export default function BundleGiftPage() {
  const params = useParams();
  const bundleId = params.bundleId as string;

  const [gifts, setGifts] = useState<GiftOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Stages: box → spinning → revealed → accepted
  const [stage, setStage] = useState<"box"|"spinning"|"revealed"|"accepted">("box");
  const [selectedGift, setSelectedGift] = useState<GiftOffer|null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [spinIndex, setSpinIndex] = useState(0);
  const spinRef = useRef<ReturnType<typeof setInterval>|null>(null);

  useEffect(() => {
    fetchGiftBundle(bundleId)
      .then((data) => {
        if (!data.length) { setNotFound(true); return; }
        setGifts(data);
        // Check if any already accepted
        const accepted = data.find(g => g.status === "accepted");
        if (accepted) { setSelectedGift(accepted); setStage("accepted"); }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [bundleId]);

  const handleOpenBox = useCallback(() => {
    if (stage !== "box" || gifts.length === 0) return;
    setStage("spinning");

    // Spinning animation - cycle through gifts rapidly then slow down
    let speed = 80;
    let count = 0;
    const totalSpins = 25 + Math.floor(Math.random() * 10);
    // Pick winner randomly from pending gifts
    const pending = gifts.filter(g => g.status === "pending" || g.status === "opened");
    const winner = pending.length > 0
      ? pending[Math.floor(Math.random() * pending.length)]
      : gifts[Math.floor(Math.random() * gifts.length)];
    const winnerIdx = gifts.findIndex(g => g.id === winner.id);

    function tick() {
      count++;
      setSpinIndex(prev => (prev + 1) % gifts.length);

      if (count >= totalSpins) {
        // Land on winner
        setSpinIndex(winnerIdx);
        setSelectedGift(winner);
        markGiftOpened(winner.id);
        setTimeout(() => {
          setStage("revealed");
          setParticles(genParticles(80));
        }, 600);
        return;
      }

      // Slow down as we approach the end
      if (count > totalSpins - 10) speed += 40;
      else if (count > totalSpins - 5) speed += 80;

      spinRef.current = setTimeout(tick, speed);
    }

    spinRef.current = setTimeout(tick, speed);

    return () => { if (spinRef.current) clearTimeout(spinRef.current); };
  }, [stage, gifts]);

  const handleAccept = useCallback(async () => {
    if (!selectedGift) return;
    await markGiftAccepted(selectedGift.id);
    setStage("accepted");
    setParticles(genParticles(120));
  }, [selectedGift]);

  const theme = BOX_THEMES[gifts[0]?.box_color || "purple"] || BOX_THEMES.purple;
  const clientName = gifts[0]?.client_name || "";
  const currentDisplayGift = gifts[spinIndex] || gifts[0];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B1120] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || gifts.length === 0) {
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
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-amber-600/10 rounded-full blur-[120px]" />
      </div>

      {/* Stars */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({length:40},(_,i)=>(
          <div key={i} className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
            style={{left:`${Math.random()*100}%`,top:`${Math.random()*100}%`,animationDelay:`${Math.random()*5}s`,opacity:Math.random()*0.5+0.1}} />
        ))}
      </div>

      {/* Confetti */}
      {particles.length > 0 && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {particles.map(p=>(
            <div key={p.id} className="absolute animate-confetti"
              style={{left:`${p.x}%`,width:p.size,height:p.size*0.6,backgroundColor:p.color,transform:`rotate(${p.rotation}deg)`,animationDelay:`${p.delay}s`,animationDuration:`${p.duration}s`,borderRadius:"1px"}} />
          ))}
        </div>
      )}

      {/* Logo */}
      <div className="relative z-10 mb-6">
        <div className="flex items-center justify-center gap-2 bg-amber-500 rounded-xl px-4 py-2">
          <div className="grid grid-cols-2 gap-0.5">
            <div className="w-4 h-4 bg-[#4527A0] rounded-sm" />
            <div className="w-4 h-4 bg-[#4527A0] rounded-sm" />
            <div className="w-4 h-4 bg-[#4527A0] rounded-sm" />
            <div className="w-4 h-4 bg-amber-600 rounded-sm flex items-center justify-center"><div className="w-1.5 h-1.5 bg-white rounded-full" /></div>
          </div>
          <div className="text-right">
            <p className="text-black text-xs font-bold leading-tight">قائمة الطلبات</p>
            <p className="text-white text-[10px] font-bold tracking-widest bg-black/80 px-1 rounded">MENU</p>
          </div>
        </div>
      </div>

      {/* Greeting */}
      <div className="relative z-10 text-center mb-8 px-6">
        <p className="text-gray-400 text-lg mb-1">مرحباً</p>
        <h1 className="text-4xl md:text-5xl font-bold text-white">{clientName}</h1>
        {stage === "box" && (
          <p className="text-gray-300 text-base md:text-lg mt-3 animate-pulse">
            لديك {gifts.length} هدايا مخفية! اضغط على الصندوق لاكتشاف هديتك
          </p>
        )}
      </div>

      {/* ─── BOX STAGE ─── */}
      {stage === "box" && (
        <div className="relative z-10">
          <button onClick={handleOpenBox} className="relative group transition-all duration-500 hover:scale-105 active:scale-95">
            <div className={`absolute -inset-8 rounded-3xl ${theme.glow} opacity-60 group-hover:opacity-100 transition-opacity`} />
            {/* Sparkles */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {Array.from({length:15},(_,i)=>(
                <div key={i} className="absolute animate-ping" style={{left:`${Math.random()*100}%`,top:`${Math.random()*100}%`,animationDelay:`${Math.random()*3}s`,animationDuration:`${Math.random()*2+1}s`}}>
                  <svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 0L7.5 4.5L12 6L7.5 7.5L6 12L4.5 7.5L0 6L4.5 4.5Z" fill="#FFD700" opacity="0.7"/></svg>
                </div>
              ))}
            </div>
            <div className="relative w-52 h-52 md:w-64 md:h-64">
              <div className={`absolute bottom-0 left-0 right-0 h-[60%] bg-gradient-to-b ${theme.bg} rounded-2xl shadow-2xl`}>
                <div className={`absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-6 ${theme.ribbon} opacity-80`} />
                {/* Gift count badge */}
                <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold text-lg shadow-lg animate-bounce">
                  {gifts.length}
                </div>
              </div>
              <div className={`absolute top-[15%] left-[-5%] right-[-5%] h-[30%] bg-gradient-to-b ${theme.lid} rounded-xl shadow-lg`}>
                <div className={`absolute top-1/2 -translate-y-1/2 left-0 right-0 h-6 ${theme.ribbon} opacity-80`} />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[120%]">
                  <div className={`w-16 h-10 ${theme.ribbon} rounded-full opacity-90`} />
                  <div className={`absolute top-1 left-1/2 -translate-x-1/2 w-4 h-4 ${theme.ribbon} rounded-full ring-2 ring-white/20`} />
                </div>
              </div>
            </div>
            <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-2">
              <span className="block w-8 h-8 border-2 border-white/30 rounded-full animate-ping" />
              <span className="text-white/60 text-base font-medium">اضغط لاكتشاف هديتك</span>
            </div>
          </button>
        </div>
      )}

      {/* ─── SPINNING STAGE ─── */}
      {stage === "spinning" && currentDisplayGift && (
        <div className="relative z-10 w-full max-w-sm mx-auto px-4">
          <div className="relative">
            {/* Spinning indicator dots */}
            <div className="flex items-center justify-center gap-2 mb-6">
              {gifts.map((g, i) => (
                <div key={g.id} className={`w-3 h-3 rounded-full transition-all duration-100 ${i === spinIndex ? "bg-amber-400 scale-150" : "bg-white/20"}`} />
              ))}
            </div>

            {/* Spinning card */}
            <div className={`bg-[#111827]/90 backdrop-blur-xl rounded-3xl border-2 border-amber-500/40 p-8 text-center transition-all duration-100 ${theme.glow}`}>
              <div className="text-7xl mb-4 transition-all duration-100">{currentDisplayGift.gift_emoji || "🎁"}</div>
              <h2 className="text-2xl font-bold text-white mb-3 transition-all duration-100">{currentDisplayGift.gift_title}</h2>
              {currentDisplayGift.gift_value && (
                <div className="inline-flex items-center px-5 py-2.5 rounded-full bg-amber-500/20 text-amber-300 font-bold text-xl">
                  {currentDisplayGift.gift_value}
                </div>
              )}
            </div>

            {/* Scanning line effect */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
              <div className="absolute w-full h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent animate-scan" />
            </div>
          </div>

          <p className="text-center text-amber-400 text-lg mt-6 animate-pulse font-medium">جاري اختيار هديتك...</p>
        </div>
      )}

      {/* ─── REVEALED STAGE ─── */}
      {stage === "revealed" && selectedGift && (
        <div className="relative z-10 w-full max-w-md mx-auto px-4 animate-in">
          {/* Sparkles */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {Array.from({length:25},(_,i)=>(
              <div key={i} className="absolute animate-ping" style={{left:`${Math.random()*100}%`,top:`${Math.random()*100}%`,animationDelay:`${Math.random()*3}s`,animationDuration:`${Math.random()*2+1}s`}}>
                <svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 0L7.5 4.5L12 6L7.5 7.5L6 12L4.5 7.5L0 6L4.5 4.5Z" fill="#FFD700" opacity="0.7"/></svg>
              </div>
            ))}
          </div>

          <div className={`relative bg-[#111827]/90 backdrop-blur-xl rounded-3xl border border-white/10 p-8 md:p-10 text-center ${theme.glow}`}>
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-5 py-1.5 rounded-full bg-amber-500 text-white text-base font-bold shadow-lg whitespace-nowrap">
              🎉 مبروك! هذي هديتك
            </div>

            <div className="text-8xl mb-5 mt-4 animate-bounce">{selectedGift.gift_emoji || "🎁"}</div>
            <h2 className="text-3xl font-bold text-white mb-3">{selectedGift.gift_title}</h2>

            {selectedGift.gift_value && (
              <div className={`inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-l ${theme.bg} text-white font-bold text-2xl mb-5`}>
                {selectedGift.gift_value}
              </div>
            )}

            {selectedGift.gift_description && (
              <p className="text-gray-300 text-base leading-relaxed mb-6">{selectedGift.gift_description}</p>
            )}

            {/* Other gifts preview */}
            {gifts.length > 1 && (
              <div className="mb-6">
                <p className="text-gray-500 text-sm mb-2">كان بإمكانك الحصول على:</p>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  {gifts.filter(g => g.id !== selectedGift.id).map(g => (
                    <span key={g.id} className="px-3 py-1.5 rounded-full bg-white/5 text-gray-400 text-sm border border-white/10">
                      {g.gift_emoji} {g.gift_title}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleAccept}
              className={`w-full py-4 rounded-2xl bg-gradient-to-l ${theme.bg} text-white font-bold text-xl hover:opacity-90 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl`}
            >
              قبول الهدية 🎉
            </button>
            <p className="text-gray-400 text-sm mt-3">بالضغط على قبول، سيتم تفعيل العرض لحسابك</p>
          </div>
        </div>
      )}

      {/* ─── ACCEPTED STAGE ─── */}
      {stage === "accepted" && selectedGift && (
        <div className="relative z-10 w-full max-w-md mx-auto px-4 animate-in">
          <div className={`bg-[#111827]/90 backdrop-blur-xl rounded-3xl border border-white/10 p-8 md:p-10 text-center ${theme.glow}`}>
            <div className="text-7xl mb-5">{selectedGift.gift_emoji || "🎁"}</div>
            <div className="w-24 h-24 mx-auto bg-emerald-500/20 rounded-full flex items-center justify-center mb-5">
              <svg className="w-12 h-12 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-emerald-400 mb-2">تم قبول الهدية بنجاح!</h3>
            <p className="text-white font-medium text-lg mb-2">{selectedGift.gift_title}</p>
            {selectedGift.gift_value && (
              <p className="text-amber-400 font-bold text-xl mb-4">{selectedGift.gift_value}</p>
            )}
            <p className="text-gray-400 text-base">سيتم التواصل معك قريباً لتفعيل العرض</p>
          </div>
        </div>
      )}

      <div className="relative z-10 mt-12 text-center">
        <p className="text-gray-500 text-sm">مدير بلاس — نهتم بعملائنا</p>
      </div>

      <style jsx global>{`
        @keyframes confetti{0%{transform:translateY(0) rotate(0deg);opacity:1}100%{transform:translateY(100vh) rotate(720deg);opacity:0}}
        .animate-confetti{animation:confetti linear forwards}
        @keyframes fadeInUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
        .animate-in{animation:fadeInUp .7s ease-out forwards}
        @keyframes scan{0%{top:-4px}100%{top:100%}}
        .animate-scan{animation:scan .4s linear infinite}
      `}</style>
    </div>
  );
}
