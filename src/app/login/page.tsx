"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("البريد الإلكتروني أو كلمة المرور غير صحيحة");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4" dir="rtl">
      {/* Background effects */}
      <div
        className="fixed inset-0 pointer-events-none dark:block hidden"
        style={{
          backgroundImage:
            "radial-gradient(circle at top right, rgba(0,212,255,0.12), transparent 24%), radial-gradient(circle at top left, rgba(139,92,246,0.08), transparent 22%)",
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan/30 to-[#8B5CF6]/30 ring-1 ring-border mb-4">
            <span className="text-lg font-extrabold tracking-[0.2em] text-primary">CC</span>
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">لوحة التحكم</h1>
          <p className="text-sm text-muted-foreground mt-1">تسجيل الدخول إلى لوحة التحكم</p>
        </div>

        {/* Login card */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl p-6 space-y-5 bg-card border border-border shadow-lg"
        >
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">البريد الإلكتروني</label>
            <input
              type="email"
              name="email"
              required
              className="w-full rounded-xl bg-background border border-border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
              placeholder="admin@example.com"
              dir="ltr"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">كلمة المرور</label>
            <input
              type="password"
              name="password"
              required
              className="w-full rounded-xl bg-background border border-border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
              placeholder="••••••••"
              dir="ltr"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-xl px-4 py-2.5 border border-destructive/20">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
          </button>
        </form>

        <p className="text-center text-[10px] text-muted-foreground/50 mt-6">
          لوحة التحكم &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
