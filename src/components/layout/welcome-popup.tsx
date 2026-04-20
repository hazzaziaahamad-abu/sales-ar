"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Rocket } from "lucide-react";

const MOTIVATIONAL_QUOTES = [
  "كل يوم هو فرصة جديدة لتحقيق إنجاز عظيم 🌟",
  "النجاح يبدأ بخطوة واحدة — خذها اليوم 🚀",
  "أنت أقرب مما تظن لتحقيق هدفك 🎯",
  "الإصرار يصنع المعجزات — لا تتوقف 💎",
  "كل بيعة تبدأ بمحاولة — ابدأ الآن ⭐",
  "الفريق الناجح يبدأ بأفراد ملتزمين — وأنت منهم 🏆",
  "اجعل اليوم يومًا لا يُنسى في سجل إنجازاتك 📈",
  "العملاء ينتظرون خدمتك المميزة — أبهرهم 🤝",
  "لا تقارن نفسك بالآخرين — تفوّق على نفسك بالأمس 💪",
  "الثقة بالنفس هي أقوى أداة بيع تملكها 🔥",
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "صباح الخير";
  if (hour < 17) return "مساء الخير";
  return "مساء النور";
}

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function WelcomePopup() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [quote] = useState(() => MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]);
  const [animateOut, setAnimateOut] = useState(false);

  useEffect(() => {
    if (!user?.name) return;
    const key = `welcome_shown_${getTodayKey()}`;
    if (localStorage.getItem(key)) return;
    const timer = setTimeout(() => setShow(true), 800);
    return () => clearTimeout(timer);
  }, [user?.name]);

  const handleConfirm = () => {
    const key = `welcome_shown_${getTodayKey()}`;
    localStorage.setItem(key, "1");
    setAnimateOut(true);
    setTimeout(() => setShow(false), 400);
  };

  if (!show || !user) return null;

  return (
    <>
      <style jsx global>{`
        @keyframes welcomeBackdrop {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes welcomeCardIn {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8) translateY(20px); }
          100% { opacity: 1; transform: translate(-50%, -50%) scale(1) translateY(0); }
        }
        @keyframes welcomeCardOut {
          0% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(0.9) translateY(-20px); }
        }
        @keyframes welcomeGlow {
          0%, 100% { box-shadow: 0 0 30px rgba(var(--primary-rgb, 59 130 246), 0.15); }
          50% { box-shadow: 0 0 60px rgba(var(--primary-rgb, 59 130 246), 0.3); }
        }
        @keyframes welcomeFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
      <div
        className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
        style={{
          animation: animateOut ? "welcomeBackdrop 0.3s ease reverse forwards" : "welcomeBackdrop 0.4s ease forwards",
        }}
        onClick={handleConfirm}
      />
      <div
        className="fixed top-1/2 left-1/2 z-[9999] w-[90vw] max-w-md"
        style={{
          animation: animateOut
            ? "welcomeCardOut 0.4s ease forwards"
            : "welcomeCardIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        }}
      >
        <div
          className="rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/[0.08] via-background to-background p-8 text-center shadow-2xl"
          style={{ animation: "welcomeGlow 3s ease infinite" }}
        >
          <div style={{ animation: "welcomeFloat 3s ease infinite" }}>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Rocket className="w-8 h-8 text-primary" />
            </div>
          </div>

          <p className="text-muted-foreground text-sm mb-1">{getGreeting()}</p>
          <h2 className="text-2xl font-black text-foreground mb-4">
            {user.name} 👋
          </h2>

          <div className="rounded-xl bg-primary/[0.05] border border-primary/10 p-4 mb-6">
            <p className="text-sm leading-relaxed text-foreground/80">{quote}</p>
          </div>

          <p className="text-sm text-muted-foreground mb-5">
            هل أنت جاهز اليوم للإنجاز؟ 💪
          </p>

          <button
            onClick={handleConfirm}
            className="w-full py-3 px-6 rounded-xl bg-primary text-primary-foreground font-bold text-base hover:brightness-110 active:scale-[0.98] transition-all"
          >
            نعم، جاهز! 🔥
          </button>
        </div>
      </div>
    </>
  );
}
