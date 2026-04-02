import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface StatCardProps {
  value: string;
  label: string;
  color: "cyan" | "green" | "amber" | "red" | "purple" | "blue" | "pink";
  progress?: number;
  icon?: React.ReactNode;
  subtext?: string;
  muted?: boolean;
  tooltip?: string;
  onClick?: () => void;
  active?: boolean;
}

const COLOR_MAP: Record<string, {
  text: string;
  bg: string;
  bar: string;
  border: string;
  glow: string;
  hex: string;
}> = {
  cyan: {
    text: "text-cyan",
    bg: "bg-cyan-dim",
    bar: "bg-cyan",
    border: "rgba(0,212,255,0.30)",
    glow: "0 0 18px rgba(0,212,255,0.08)",
    hex: "#00D4FF",
  },
  green: {
    text: "text-cc-green",
    bg: "bg-green-dim",
    bar: "bg-cc-green",
    border: "rgba(16,185,129,0.30)",
    glow: "0 0 18px rgba(16,185,129,0.08)",
    hex: "#10B981",
  },
  amber: {
    text: "text-amber",
    bg: "bg-amber-dim",
    bar: "bg-amber",
    border: "rgba(245,158,11,0.30)",
    glow: "0 0 18px rgba(245,158,11,0.08)",
    hex: "#F59E0B",
  },
  red: {
    text: "text-cc-red",
    bg: "bg-red-dim",
    bar: "bg-cc-red",
    border: "rgba(239,68,68,0.30)",
    glow: "0 0 18px rgba(239,68,68,0.08)",
    hex: "#EF4444",
  },
  purple: {
    text: "text-cc-purple",
    bg: "bg-purple-dim",
    bar: "bg-cc-purple",
    border: "rgba(139,92,246,0.30)",
    glow: "0 0 18px rgba(139,92,246,0.08)",
    hex: "#8B5CF6",
  },
  blue: {
    text: "text-cc-blue",
    bg: "bg-blue-dim",
    bar: "bg-cc-blue",
    border: "rgba(125,166,255,0.30)",
    glow: "0 0 18px rgba(125,166,255,0.08)",
    hex: "#7da6ff",
  },
  pink: {
    text: "text-pink",
    bg: "bg-pink/15",
    bar: "bg-pink",
    border: "rgba(236,72,153,0.30)",
    glow: "0 0 18px rgba(236,72,153,0.08)",
    hex: "#EC4899",
  },
};

export function StatCard({ value, label, color, progress, icon, subtext, muted, tooltip, onClick, active }: StatCardProps) {
  const c = COLOR_MAP[color];
  const content = (
    <div
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-[14px] p-5 transition-all duration-200",
        muted && "opacity-60",
        onClick && "cursor-pointer",
        active && "ring-2 ring-offset-1 ring-offset-transparent"
      )}
      style={{
        backgroundColor: "var(--card)",
        border: `1px solid ${active ? c.border.replace(/0\.30/, "0.8") : c.border}`,
        boxShadow: active ? c.glow.replace(/0\.08/, "0.25") : c.glow,
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = c.hex; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = active ? c.border.replace(/0\.30/, "0.8") : c.border; }}
    >
      {/* Decorative orb */}
      <div className="absolute -top-4 -right-4 w-[60px] h-[60px] rounded-full opacity-[0.08]"
        style={{ background: c.hex }} />

      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className="text-xs text-muted-foreground font-semibold">{label}</p>
          <p className={cn("mt-2 text-[28px] font-extrabold tracking-tight font-mono", c.text)}>{value}</p>
          {subtext && <p className="text-[11px] text-muted-foreground mt-1.5">{subtext}</p>}
        </div>
        {icon && (
          <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center ring-1 ring-white/8", c.bg)}>
            {icon}
          </div>
        )}
      </div>
      {progress !== undefined && (
        <div className="mt-4 w-full h-[6px] rounded-[3px] overflow-hidden relative z-10" style={{ background: "var(--border)" }}>
          <div
            className={cn("h-full rounded-[3px] transition-all duration-400", c.bar)}
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
      )}
    </div>
  );

  if (!tooltip) {
    return content;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={<div />}>{content}</TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
