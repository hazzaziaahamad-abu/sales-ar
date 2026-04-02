import { cn } from "@/lib/utils";

interface ColorBadgeProps {
  text: string;
  color: "cyan" | "green" | "amber" | "red" | "purple" | "blue" | "pink";
  size?: "sm" | "md";
}

const COLOR_CLASSES = {
  cyan: "bg-cyan-dim text-cyan",
  green: "bg-green-dim text-cc-green",
  amber: "bg-amber-dim text-amber",
  red: "bg-red-dim text-cc-red",
  purple: "bg-purple-dim text-cc-purple",
  blue: "bg-blue-dim text-cc-blue",
  pink: "bg-pink/15 text-pink",
};

export function ColorBadge({ text, color, size = "sm" }: ColorBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-bold whitespace-nowrap",
        COLOR_CLASSES[color],
        size === "sm" ? "px-[9px] py-[3px] text-[11px]" : "px-[10px] py-[3px] text-xs"
      )}
    >
      {text}
    </span>
  );
}
