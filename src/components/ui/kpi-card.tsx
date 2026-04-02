import { cn } from "@/lib/utils";
import { KPI_STATUS_STYLES } from "@/lib/utils/constants";
import { Check, X } from "lucide-react";

interface KPICardProps {
  label: string;
  value: string;
  target: string;
  status: "excellent" | "improving" | "behind";
  icon?: React.ReactNode;
}

const STATUS_COLORS: Record<string, { border: string; glow: string; text: string; hex: string }> = {
  excellent: {
    border: "rgba(16, 185, 129, 0.30)",
    glow: "0 0 18px rgba(16, 185, 129, 0.08)",
    text: "text-cc-green",
    hex: "#10B981",
  },
  improving: {
    border: "rgba(245, 158, 11, 0.30)",
    glow: "0 0 18px rgba(245, 158, 11, 0.08)",
    text: "text-amber",
    hex: "#F59E0B",
  },
  behind: {
    border: "rgba(239, 68, 68, 0.30)",
    glow: "0 0 18px rgba(239, 68, 68, 0.08)",
    text: "text-cc-red",
    hex: "#EF4444",
  },
};

export function KPICard({ label, value, target, status, icon }: KPICardProps) {
  const styles = KPI_STATUS_STYLES[status];
  const colors = STATUS_COLORS[status];
  const StatusIcon = status === "behind" ? X : Check;

  return (
    <div
      className="relative overflow-hidden rounded-[14px] p-5 min-h-[160px] flex flex-col justify-between transition-all duration-200"
      style={{
        backgroundColor: "var(--card)",
        border: `1px solid ${colors.border}`,
        boxShadow: colors.glow,
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = colors.hex; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = colors.border; }}
    >
      {/* Decorative orb */}
      <div className="absolute -top-4 -right-4 w-[60px] h-[60px] rounded-full opacity-[0.08]"
        style={{ background: colors.hex }} />

      {/* Top: Label */}
      <p className="text-xs text-muted-foreground font-semibold relative z-10">{label}</p>

      {/* Center: Value */}
      <p className={cn("text-[22px] font-extrabold font-mono relative z-10 my-2", colors.text)}>
        {value}
      </p>

      {/* Bottom: Status + Target */}
      <div className="flex items-center justify-between relative z-10">
        <span className="cc-badge" style={{ background: `${colors.hex}25`, color: colors.hex }}>
          <StatusIcon className="w-3.5 h-3.5" />
          {status === "excellent" ? "ممتاز" : status === "improving" ? "تحسن" : "متأخر"}
        </span>
        <span className="text-[11px] text-muted-foreground">
          الهدف: <span className="font-mono">{target}</span>
        </span>
      </div>
    </div>
  );
}
