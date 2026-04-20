"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

interface CelebrationEvent {
  id: string;
  repName: string;
  clientName: string;
  value: number;
  type: "office" | "support" | "renewal";
}

const TYPE_LABELS: Record<string, string> = {
  office: "بيعة مكتب",
  support: "بيعة دعم",
  renewal: "تجديد",
};

const CONFETTI_COLORS = ["#FFD700", "#FF6B6B", "#4ECDC4", "#45B7D1", "#96E6A1", "#DDA0DD", "#F0E68C", "#87CEEB"];

function ConfettiPiece({ index }: { index: number }) {
  const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length];
  const left = Math.random() * 100;
  const delay = Math.random() * 0.5;
  const duration = 2 + Math.random() * 2;
  const rotation = Math.random() * 360;
  const size = 6 + Math.random() * 6;
  const shape = index % 3 === 0 ? "circle" : index % 3 === 1 ? "square" : "strip";

  return (
    <div
      className="absolute top-0 pointer-events-none"
      style={{
        left: `${left}%`,
        animationDelay: `${delay}s`,
        animationDuration: `${duration}s`,
        animationName: "confettiFall",
        animationTimingFunction: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        animationFillMode: "forwards",
      }}
    >
      <div
        style={{
          width: shape === "strip" ? size * 0.4 : size,
          height: shape === "strip" ? size * 1.5 : size,
          backgroundColor: color,
          borderRadius: shape === "circle" ? "50%" : shape === "strip" ? "2px" : "1px",
          transform: `rotate(${rotation}deg)`,
          animationName: "confettiSpin",
          animationDuration: `${duration * 0.8}s`,
          animationIterationCount: "infinite",
          animationTimingFunction: "linear",
        }}
      />
    </div>
  );
}

export function SaleCelebration() {
  const [event, setEvent] = useState<CelebrationEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const processedRef = useRef<Set<string>>(new Set());

  const showCelebration = useCallback((e: CelebrationEvent) => {
    if (processedRef.current.has(e.id)) return;
    processedRef.current.add(e.id);
    if (processedRef.current.size > 50) {
      const arr = Array.from(processedRef.current);
      processedRef.current = new Set(arr.slice(-25));
    }

    setEvent(e);
    setVisible(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setVisible(false);
      setTimeout(() => setEvent(null), 500);
    }, 5000);
  }, []);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("sale-celebrations")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "deals" },
        (payload) => {
          const newRow = payload.new as Record<string, unknown>;
          const oldRow = payload.old as Record<string, unknown>;
          if (newRow.stage === "مكتملة" && oldRow.stage !== "مكتملة") {
            showCelebration({
              id: `deal-${newRow.id}`,
              repName: (newRow.assigned_rep_name as string) || "أحد الفريق",
              clientName: (newRow.client_name as string) || "",
              value: (newRow.deal_value as number) || 0,
              type: newRow.sales_type === "support" ? "support" : "office",
            });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "deals", filter: "stage=eq.مكتملة" },
        (payload) => {
          const newRow = payload.new as Record<string, unknown>;
          showCelebration({
            id: `deal-${newRow.id}`,
            repName: (newRow.assigned_rep_name as string) || "أحد الفريق",
            clientName: (newRow.client_name as string) || "",
            value: (newRow.deal_value as number) || 0,
            type: newRow.sales_type === "support" ? "support" : "office",
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "renewals" },
        (payload) => {
          const newRow = payload.new as Record<string, unknown>;
          const oldRow = payload.old as Record<string, unknown>;
          if (newRow.status === "مكتمل" && oldRow.status !== "مكتمل") {
            showCelebration({
              id: `renewal-${newRow.id}`,
              repName: (newRow.assigned_rep as string) || "أحد الفريق",
              clientName: (newRow.customer_name as string) || "",
              value: (newRow.plan_price as number) || 0,
              type: "renewal",
            });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "renewals", filter: "status=eq.مكتمل" },
        (payload) => {
          const newRow = payload.new as Record<string, unknown>;
          showCelebration({
            id: `renewal-${newRow.id}`,
            repName: (newRow.assigned_rep as string) || "أحد الفريق",
            clientName: (newRow.customer_name as string) || "",
            value: (newRow.plan_price as number) || 0,
            type: "renewal",
          });
        }
      )
      .subscribe();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      supabase.removeChannel(channel);
    };
  }, [showCelebration]);

  if (!event) return null;

  return (
    <>
      <style jsx global>{`
        @keyframes confettiFall {
          0% { transform: translateY(-10vh) scale(1); opacity: 1; }
          100% { transform: translateY(110vh) scale(0.5); opacity: 0; }
        }
        @keyframes confettiSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(720deg); }
        }
        @keyframes celebrationPulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.05); }
        }
        @keyframes celebrationSlideIn {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
          100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes celebrationSlideOut {
          0% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
        }
        @keyframes starBurst {
          0% { transform: scale(0) rotate(0deg); opacity: 1; }
          100% { transform: scale(3) rotate(180deg); opacity: 0; }
        }
      `}</style>
      <div
        className="fixed inset-0 z-[9999] pointer-events-none"
        style={{
          animation: visible ? "none" : "none",
          opacity: visible ? 1 : 0,
          transition: "opacity 0.5s ease",
        }}
      >
        {/* Confetti */}
        {visible && Array.from({ length: 60 }).map((_, i) => (
          <ConfettiPiece key={i} index={i} />
        ))}

        {/* Celebration card */}
        <div
          className="absolute top-1/2 left-1/2 w-[90vw] max-w-sm pointer-events-auto"
          style={{
            animation: visible
              ? "celebrationSlideIn 0.5s ease forwards, celebrationPulse 2s ease infinite 0.5s"
              : "celebrationSlideOut 0.5s ease forwards",
            transformOrigin: "center center",
          }}
        >
          {/* Star burst behind */}
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ animation: "starBurst 2s ease forwards" }}
          >
            <div className="w-32 h-32 rounded-full bg-yellow-400/20 blur-xl" />
          </div>

          <div className="relative rounded-2xl border-2 border-yellow-400/40 bg-gradient-to-b from-yellow-400/10 via-background/95 to-background/95 backdrop-blur-xl p-6 text-center shadow-2xl shadow-yellow-400/10">
            <div className="text-5xl mb-3">🎉</div>
            <p className="text-lg font-bold text-yellow-400 mb-1">
              بيعة جديدة!
            </p>
            <p className="text-xl font-black text-foreground mb-2">
              {event.repName}
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-3">
              <span className="px-2 py-0.5 rounded-full bg-yellow-400/10 text-yellow-400 text-xs font-bold">
                {TYPE_LABELS[event.type]}
              </span>
              {event.clientName && (
                <span>— {event.clientName}</span>
              )}
            </div>
            <p className="text-2xl font-black text-emerald-400">
              {event.value.toLocaleString()} ر.س
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
