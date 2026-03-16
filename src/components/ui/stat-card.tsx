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
}

const COLOR_MAP: Record<string, {
  text: string;
  bg: string;
  bar: string;
  gradient: string;
  border: string;
  glow: string;
  orb: string;
}> = {
  cyan: {
    text: "text-cyan",
    bg: "bg-cyan-dim",
    bar: "bg-cyan",
    gradient: "linear-gradient(135deg, rgba(0,212,255,0.12) 0%, rgba(0,212,255,0.03) 50%, rgba(17,24,39,0.95) 100%)",
    border: "rgba(0,212,255,0.35)",
    glow: "0 0 18px rgba(0,212,255,0.12)",
    orb: "radial-gradient(circle, rgba(0,212,255,0.22) 0%, rgba(0,212,255,0.06) 50%, transparent 70%)",
  },
  green: {
    text: "text-cc-green",
    bg: "bg-green-dim",
    bar: "bg-cc-green",
    gradient: "linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(16,185,129,0.03) 50%, rgba(17,24,39,0.95) 100%)",
    border: "rgba(16,185,129,0.35)",
    glow: "0 0 18px rgba(16,185,129,0.12)",
    orb: "radial-gradient(circle, rgba(16,185,129,0.22) 0%, rgba(16,185,129,0.06) 50%, transparent 70%)",
  },
  amber: {
    text: "text-amber",
    bg: "bg-amber-dim",
    bar: "bg-amber",
    gradient: "linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(245,158,11,0.03) 50%, rgba(17,24,39,0.95) 100%)",
    border: "rgba(245,158,11,0.35)",
    glow: "0 0 18px rgba(245,158,11,0.12)",
    orb: "radial-gradient(circle, rgba(245,158,11,0.22) 0%, rgba(245,158,11,0.06) 50%, transparent 70%)",
  },
  red: {
    text: "text-cc-red",
    bg: "bg-red-dim",
    bar: "bg-cc-red",
    gradient: "linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(239,68,68,0.03) 50%, rgba(17,24,39,0.95) 100%)",
    border: "rgba(239,68,68,0.35)",
    glow: "0 0 18px rgba(239,68,68,0.12)",
    orb: "radial-gradient(circle, rgba(239,68,68,0.22) 0%, rgba(239,68,68,0.06) 50%, transparent 70%)",
  },
  purple: {
    text: "text-cc-purple",
    bg: "bg-purple-dim",
    bar: "bg-cc-purple",
    gradient: "linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(139,92,246,0.03) 50%, rgba(17,24,39,0.95) 100%)",
    border: "rgba(139,92,246,0.35)",
    glow: "0 0 18px rgba(139,92,246,0.12)",
    orb: "radial-gradient(circle, rgba(139,92,246,0.22) 0%, rgba(139,92,246,0.06) 50%, transparent 70%)",
  },
  blue: {
    text: "text-cc-blue",
    bg: "bg-blue-dim",
    bar: "bg-cc-blue",
    gradient: "linear-gradient(135deg, rgba(125,166,255,0.12) 0%, rgba(125,166,255,0.03) 50%, rgba(17,24,39,0.95) 100%)",
    border: "rgba(125,166,255,0.35)",
    glow: "0 0 18px rgba(125,166,255,0.12)",
    orb: "radial-gradient(circle, rgba(125,166,255,0.22) 0%, rgba(125,166,255,0.06) 50%, transparent 70%)",
  },
  pink: {
    text: "text-pink",
    bg: "bg-pink/15",
    bar: "bg-pink",
    gradient: "linear-gradient(135deg, rgba(236,72,153,0.12) 0%, rgba(236,72,153,0.03) 50%, rgba(17,24,39,0.95) 100%)",
    border: "rgba(236,72,153,0.35)",
    glow: "0 0 18px rgba(236,72,153,0.12)",
    orb: "radial-gradient(circle, rgba(236,72,153,0.22) 0%, rgba(236,72,153,0.06) 50%, transparent 70%)",
  },
};

export function StatCard({ value, label, color, progress, icon, subtext, muted, tooltip }: StatCardProps) {
  const c = COLOR_MAP[color];
  const content = (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl p-4 transition-opacity",
        muted && "opacity-60"
      )}
      style={{
        background: c.gradient,
        border: `1px solid ${c.border}`,
        boxShadow: c.glow,
      }}
    >
      {/* Large orb decoration */}
      <div
        className="absolute -left-6 top-[-10%] w-28 h-28 rounded-full pointer-events-none"
        style={{ background: c.orb }}
      />

      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
          <p className={cn("mt-2 text-3xl font-extrabold tracking-tight", c.text)}>{value}</p>
          {subtext && <p className="text-[11px] text-muted-foreground mt-1.5">{subtext}</p>}
        </div>
        {icon && (
          <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center ring-1 ring-white/8", c.bg)}>
            {icon}
          </div>
        )}
      </div>
      {progress !== undefined && (
        <div className="mt-4 w-full h-1.5 bg-white/[0.05] rounded-full overflow-hidden relative z-10">
          <div
            className={cn("h-full rounded-full transition-all", c.bar)}
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
