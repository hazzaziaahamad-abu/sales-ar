"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Shield,
  Users,
  CalendarCheck,
  ChevronDown,
  Check,
  X,
  Loader2,
  AlertTriangle,
  Crown,
  UserCog,
  User,
} from "lucide-react";

type PermissionKey = {
  id: string;
  key: string;
  label_ar: string;
  description_ar: string;
  category: string;
  sort_order: number;
};

type UserPerm = {
  permission_key: string;
  granted: boolean;
  updated_at: string;
};

type DecisionRow = {
  id: string;
  category: string;
  decision_ar: string;
  authority_level: string;
  threshold_value: number | null;
  notes_ar: string | null;
};

type WeeklyDecision = {
  id: string;
  decision_text: string;
  week_start: string;
  status: string;
  notes_ar: string | null;
  created_at: string;
  decided_by_profile: { name: string } | null;
};

type UserProfile = {
  id: string;
  name: string;
  email: string;
  is_super_admin: boolean;
  roles: { name: string; slug: string } | null;
};

const TABS = [
  { id: "decisions", label: "مصفوفة القرارات", icon: Shield },
  { id: "permissions", label: "صلاحيات الموظفين", icon: Users },
  { id: "weekly", label: "الاجتماع الأسبوعي", icon: CalendarCheck },
] as const;

const LEVEL_CONFIG: Record<string, { label: string; color: string; icon: typeof Crown }> = {
  rep: { label: "مندوب", color: "emerald", icon: User },
  lead: { label: "قائد فريق", color: "amber", icon: UserCog },
  founder: { label: "مؤسس", color: "red", icon: Crown },
};

const CATEGORY_COLORS: Record<string, string> = {
  sales_visibility: "violet",
  financial: "emerald",
  governance: "amber",
};

const ROLE_TEMPLATES = [
  { slug: "rep", label: "مندوب" },
  { slug: "lead", label: "قائد فريق" },
  { slug: "founder", label: "مؤسس" },
];

export default function GovernancePage() {
  const [activeTab, setActiveTab] = useState<string>("decisions");

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">الحوكمة والصلاحيات</h1>
        <p className="text-sm text-muted-foreground mt-1">
          إدارة مصفوفة القرارات وصلاحيات الموظفين والاجتماعات الأسبوعية
        </p>
      </div>

      <div className="flex gap-2 border-b border-border/50 pb-0">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-all ${
                isActive
                  ? "border-violet-500 text-violet-400 bg-violet-500/10"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-white/[0.03]"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "decisions" && <DecisionMatrix />}
      {activeTab === "permissions" && <PermissionsPanel />}
      {activeTab === "weekly" && <WeeklyMeeting />}
    </div>
  );
}

function DecisionMatrix() {
  const [decisions, setDecisions] = useState<DecisionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLevel, setEditLevel] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/governance/decisions/authority")
      .then((r) => r.json())
      .then(setDecisions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/governance/decisions/authority/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authority_level: editLevel }),
      });
      if (res.ok) {
        const updated = await res.json();
        setDecisions((prev) => prev.map((d) => (d.id === id ? updated : d)));
        setEditingId(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;

  const grouped = decisions.reduce<Record<string, DecisionRow[]>>((acc, d) => {
    (acc[d.category] = acc[d.category] || []).push(d);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([category, items]) => (
        <div
          key={category}
          className="rounded-xl border border-border/50 bg-card overflow-hidden"
        >
          <div className="px-4 py-3 bg-white/[0.02] border-b border-border/30">
            <h3 className="text-sm font-bold text-foreground">{category}</h3>
          </div>
          <div className="divide-y divide-border/20">
            {items.map((d) => {
              const level = LEVEL_CONFIG[d.authority_level] || LEVEL_CONFIG.founder;
              const LevelIcon = level.icon;
              const isEditing = editingId === d.id;

              return (
                <div
                  key={d.id}
                  className="px-4 py-3 flex items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{d.decision_ar}</p>
                    {d.notes_ar && (
                      <p className="text-xs text-muted-foreground mt-0.5">{d.notes_ar}</p>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={editLevel}
                        onChange={(e) => setEditLevel(e.target.value)}
                        className="text-xs bg-background border border-border rounded-md px-2 py-1.5"
                      >
                        {Object.entries(LEVEL_CONFIG).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v.label}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleSave(d.id)}
                        disabled={saving}
                        className="p-1.5 rounded-md bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                      >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-1.5 rounded-md bg-red-500/20 text-red-400 hover:bg-red-500/30"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingId(d.id);
                        setEditLevel(d.authority_level);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors
                        ${
                          d.authority_level === "rep"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                            : d.authority_level === "lead"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
                            : "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20"
                        }`}
                    >
                      <LevelIcon className="w-3 h-3" />
                      {level.label}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function PermissionsPanel() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [keys, setKeys] = useState<PermissionKey[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userPerms, setUserPerms] = useState<UserPerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [permLoading, setPermLoading] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [applyingTemplate, setApplyingTemplate] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/users").then((r) => r.json()),
      fetch("/api/governance/permissions/keys").then((r) => r.json()),
    ])
      .then(([u, k]) => {
        setUsers(Array.isArray(u) ? u : []);
        setKeys(Array.isArray(k) ? k : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const loadUserPerms = useCallback(async (userId: string) => {
    setSelectedUser(userId);
    setPermLoading(true);
    try {
      const res = await fetch(`/api/governance/permissions/user/${userId}`);
      const data = await res.json();
      setUserPerms(Array.isArray(data) ? data : []);
    } catch {
      setUserPerms([]);
    } finally {
      setPermLoading(false);
    }
  }, []);

  const togglePerm = async (userId: string, key: string, currentGranted: boolean) => {
    setToggling(key);
    try {
      const res = await fetch(`/api/governance/permissions/user/${userId}/${key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ granted: !currentGranted }),
      });
      if (res.ok) {
        setUserPerms((prev) => {
          const exists = prev.find((p) => p.permission_key === key);
          if (exists) {
            return prev.map((p) =>
              p.permission_key === key ? { ...p, granted: !currentGranted } : p
            );
          }
          return [...prev, { permission_key: key, granted: !currentGranted, updated_at: new Date().toISOString() }];
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setToggling(null);
    }
  };

  const applyTemplate = async (userId: string, roleSlug: string) => {
    setApplyingTemplate(true);
    try {
      const res = await fetch(`/api/governance/permissions/user/${userId}/apply-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role_slug: roleSlug }),
      });
      if (res.ok) {
        await loadUserPerms(userId);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setApplyingTemplate(false);
    }
  };

  if (loading) return <LoadingState />;

  const selectedProfile = users.find((u) => u.id === selectedUser);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Users list */}
      <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
        <div className="px-4 py-3 bg-white/[0.02] border-b border-border/30">
          <h3 className="text-sm font-bold text-foreground">الموظفين</h3>
        </div>
        <div className="divide-y divide-border/20 max-h-[600px] overflow-y-auto">
          {users.map((u) => (
            <button
              key={u.id}
              onClick={() => loadUserPerms(u.id)}
              className={`w-full px-4 py-3 text-right flex items-center gap-3 transition-colors ${
                selectedUser === u.id
                  ? "bg-violet-500/10 border-r-2 border-violet-500"
                  : "hover:bg-white/[0.03]"
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-violet-400">
                  {u.name?.charAt(0) || "?"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{u.name}</p>
                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
              </div>
              {u.is_super_admin && (
                <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Permissions detail */}
      <div className="lg:col-span-2 rounded-xl border border-border/50 bg-card overflow-hidden">
        {!selectedUser ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
            اختر موظف لعرض صلاحياته
          </div>
        ) : permLoading ? (
          <LoadingState />
        ) : (
          <>
            <div className="px-4 py-3 bg-white/[0.02] border-b border-border/30 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  صلاحيات {selectedProfile?.name}
                </h3>
                {selectedProfile?.is_super_admin && (
                  <p className="text-xs text-amber-400 mt-0.5">مشرف عام — يملك كل الصلاحيات تلقائياً</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">تطبيق قالب:</span>
                {ROLE_TEMPLATES.map((t) => (
                  <button
                    key={t.slug}
                    onClick={() => applyTemplate(selectedUser!, t.slug)}
                    disabled={applyingTemplate}
                    className="text-xs px-2.5 py-1 rounded-md border border-border/50 text-muted-foreground hover:text-foreground hover:bg-white/[0.05] transition-colors disabled:opacity-50"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-border/20">
              {keys.map((k) => {
                const perm = userPerms.find((p) => p.permission_key === k.key);
                const granted = perm?.granted ?? false;
                const isToggling = toggling === k.key;
                const catColor = CATEGORY_COLORS[k.category] || "slate";

                return (
                  <div
                    key={k.key}
                    className="px-4 py-3 flex items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{k.label_ar}</p>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full bg-${catColor}-500/10 text-${catColor}-400`}
                        >
                          {k.category === "sales_visibility"
                            ? "رؤية المبيعات"
                            : k.category === "financial"
                            ? "مالي"
                            : "حوكمة"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {k.description_ar}
                      </p>
                    </div>

                    <button
                      onClick={() => togglePerm(selectedUser!, k.key, granted)}
                      disabled={isToggling}
                      className={`relative w-11 h-6 rounded-full transition-colors ${
                        granted ? "bg-emerald-500" : "bg-zinc-700"
                      }`}
                    >
                      {isToggling ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin absolute top-1 right-1 text-white" />
                      ) : (
                        <div
                          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                            granted ? "right-0.5" : "right-5"
                          }`}
                        />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function WeeklyMeeting() {
  const [decisions, setDecisions] = useState<WeeklyDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDecisions, setNewDecisions] = useState<{ text: string; notes: string }[]>([
    { text: "", notes: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/governance/meetings/decisions")
      .then((r) => r.json())
      .then((d) => setDecisions(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const addRow = () => {
    if (newDecisions.length >= 3) return;
    setNewDecisions((prev) => [...prev, { text: "", notes: "" }]);
  };

  const removeRow = (idx: number) => {
    setNewDecisions((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateRow = (idx: number, field: "text" | "notes", value: string) => {
    setNewDecisions((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r))
    );
  };

  const submit = async () => {
    const valid = newDecisions.filter((d) => d.text.trim());
    if (valid.length === 0) {
      setError("أدخل قرار واحد على الأقل");
      return;
    }
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/governance/meetings/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisions: valid }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "حدث خطأ");
        return;
      }

      const created = await res.json();
      setDecisions((prev) => [...created, ...prev]);
      setNewDecisions([{ text: "", notes: "" }]);
    } catch {
      setError("خطأ في الاتصال");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState />;

  const weekGroups = decisions.reduce<Record<string, WeeklyDecision[]>>((acc, d) => {
    (acc[d.week_start] = acc[d.week_start] || []).push(d);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* New decisions form */}
      <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
        <div className="px-4 py-3 bg-white/[0.02] border-b border-border/30">
          <h3 className="text-sm font-bold text-foreground">إضافة قرارات هذا الأسبوع</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            الحد الأقصى ٣ قرارات في الأسبوع
          </p>
        </div>
        <div className="p-4 space-y-3">
          {newDecisions.map((d, idx) => (
            <div key={idx} className="flex gap-2">
              <div className="flex-1 space-y-2">
                <input
                  type="text"
                  value={d.text}
                  onChange={(e) => updateRow(idx, "text", e.target.value)}
                  placeholder={`القرار ${idx + 1}`}
                  className="w-full text-sm bg-background border border-border/50 rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                />
                <input
                  type="text"
                  value={d.notes}
                  onChange={(e) => updateRow(idx, "notes", e.target.value)}
                  placeholder="ملاحظات (اختياري)"
                  className="w-full text-xs bg-background border border-border/50 rounded-lg px-3 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                />
              </div>
              {newDecisions.length > 1 && (
                <button
                  onClick={() => removeRow(idx)}
                  className="self-start p-2 text-red-400 hover:bg-red-500/10 rounded-md"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-400">
              <AlertTriangle className="w-3.5 h-3.5" />
              {error}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            {newDecisions.length < 3 && (
              <button
                onClick={addRow}
                className="text-xs px-3 py-1.5 rounded-md border border-dashed border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
              >
                + إضافة قرار
              </button>
            )}
            <button
              onClick={submit}
              disabled={submitting}
              className="text-xs px-4 py-1.5 rounded-md bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                "حفظ القرارات"
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Previous decisions */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-foreground">القرارات السابقة</h3>
        {Object.keys(weekGroups).length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد قرارات مسجلة</p>
        ) : (
          Object.entries(weekGroups).map(([week, items]) => (
            <div
              key={week}
              className="rounded-xl border border-border/50 bg-card overflow-hidden"
            >
              <div className="px-4 py-2.5 bg-white/[0.02] border-b border-border/30">
                <span className="text-xs font-medium text-muted-foreground">
                  أسبوع {new Date(week).toLocaleDateString("ar-SA")}
                </span>
              </div>
              <div className="divide-y divide-border/20">
                {items.map((d) => (
                  <div key={d.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-foreground">{d.decision_text}</p>
                      <span
                        className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full ${
                          d.status === "completed"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : d.status === "cancelled"
                            ? "bg-red-500/10 text-red-400"
                            : "bg-amber-500/10 text-amber-400"
                        }`}
                      >
                        {d.status === "completed"
                          ? "مكتمل"
                          : d.status === "cancelled"
                          ? "ملغي"
                          : "قيد التنفيذ"}
                      </span>
                    </div>
                    {d.notes_ar && (
                      <p className="text-xs text-muted-foreground mt-1">{d.notes_ar}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      {d.decided_by_profile?.name || "—"} •{" "}
                      {new Date(d.created_at).toLocaleDateString("ar-SA")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
    </div>
  );
}
