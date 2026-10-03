import Link from "next/link";
import { Megaphone, Clapperboard } from "lucide-react";
import { cn } from "@/lib/utils";

/** تبويبات قسم «الخطط التسويقية»: الخطط الاستراتيجية + التسويق بالمحتوى. */
export function MarketingTabs({ active }: { active: "plans" | "content" }) {
  const tabs = [
    { key: "plans", href: "/marketing-plans", label: "الخطط الاستراتيجية", icon: Megaphone },
    { key: "content", href: "/marketing-plans/content", label: "التسويق بالمحتوى", icon: Clapperboard },
  ] as const;
  return (
    <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-border w-fit">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={cn(
            "flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors",
            active === t.key ? "bg-violet-500/20 text-violet-300" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <t.icon className="w-4 h-4" />
          {t.label}
        </Link>
      ))}
    </div>
  );
}
