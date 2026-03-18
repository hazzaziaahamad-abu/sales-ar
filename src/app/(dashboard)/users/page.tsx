"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { Shield, Plus, Pencil, Trash2, Users, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// All available pages with Arabic labels
const ALL_PAGES = [
  { slug: "dashboard", label: "نظرة عامة" },
  { slug: "sales", label: "المبيعات" },
  { slug: "renewals", label: "التجديدات" },
  { slug: "satisfaction", label: "رضا العملاء" },
  { slug: "support", label: "الدعم" },
  { slug: "development", label: "التطويرات" },
  { slug: "partnerships", label: "الشراكات" },
  { slug: "team", label: "الفريق" },
  { slug: "finance", label: "المالية" },
  { slug: "upload", label: "رفع البيانات" },
  { slug: "agent", label: "المساعد الذكي" },
  { slug: "users", label: "إدارة المستخدمين" },
];

interface Role {
  id: string;
  name: string;
  slug: string;
  org_id: string | null;
  allowed_pages: string[];
  is_system: boolean;
  organizations?: { name: string; name_ar: string } | null;
}

interface UserProfile {
  id: string;
  email: string;
  name: string;
  org_id: string;
  role_id: string;
  is_super_admin: boolean;
  roles: { id: string; name: string; slug: string };
  organizations: { name: string; name_ar: string };
}

export default function UsersPage() {
  const { user, orgs } = useAuth();
  const router = useRouter();

  // Redirect non-super-admin
  useEffect(() => {
    if (user && !user.isSuperAdmin) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Role dialog state
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleName, setRoleName] = useState("");
  const [roleSlug, setRoleSlug] = useState("");
  const [roleOrgId, setRoleOrgId] = useState<string>("");
  const [rolePages, setRolePages] = useState<string[]>([]);
  const [roleSaving, setRoleSaving] = useState(false);

  // User dialog state
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userOrgId, setUserOrgId] = useState("");
  const [userRoleId, setUserRoleId] = useState("");
  const [userSaving, setUserSaving] = useState(false);

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "role" | "user"; id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [rolesRes, usersRes] = await Promise.all([
      fetch("/api/roles"),
      fetch("/api/users"),
    ]);
    if (rolesRes.ok) setRoles(await rolesRes.json());
    if (usersRes.ok) setUsers(await usersRes.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user?.isSuperAdmin) fetchData();
  }, [user, fetchData]);

  // --- Role CRUD ---
  function openRoleDialog(role?: Role) {
    if (role) {
      setEditingRole(role);
      setRoleName(role.name);
      setRoleSlug(role.slug);
      setRoleOrgId(role.org_id || "");
      setRolePages(role.allowed_pages);
    } else {
      setEditingRole(null);
      setRoleName("");
      setRoleSlug("");
      setRoleOrgId("");
      setRolePages(["dashboard"]);
    }
    setRoleDialogOpen(true);
  }

  async function saveRole() {
    setRoleSaving(true);
    const body = {
      name: roleName,
      slug: roleSlug,
      org_id: roleOrgId || null,
      allowed_pages: rolePages,
    };

    const url = editingRole ? `/api/roles/${editingRole.id}` : "/api/roles";
    const method = editingRole ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setRoleDialogOpen(false);
      fetchData();
    }
    setRoleSaving(false);
  }

  // --- User CRUD ---
  function openUserDialog(u?: UserProfile) {
    if (u) {
      setEditingUser(u);
      setUserName(u.name);
      setUserEmail(u.email);
      setUserPassword("");
      setUserOrgId(u.org_id);
      setUserRoleId(u.role_id);
    } else {
      setEditingUser(null);
      setUserName("");
      setUserEmail("");
      setUserPassword("");
      setUserOrgId(orgs[0]?.id || "");
      // Pre-select first non-system role
      const firstRole = roles.find((r) => !r.is_system);
      setUserRoleId(firstRole?.id || "");
    }
    setUserDialogOpen(true);
  }

  async function saveUser() {
    setUserSaving(true);
    const body: Record<string, unknown> = {
      name: userName,
      email: userEmail,
      org_id: userOrgId,
      role_id: userRoleId,
    };

    if (!editingUser) {
      body.password = userPassword;
    }

    const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";
    const method = editingUser ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setUserDialogOpen(false);
      fetchData();
    }
    setUserSaving(false);
  }

  // --- Delete ---
  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);

    const url = deleteTarget.type === "role"
      ? `/api/roles/${deleteTarget.id}`
      : `/api/users/${deleteTarget.id}`;

    const res = await fetch(url, { method: "DELETE" });
    if (res.ok) {
      setDeleteOpen(false);
      setDeleteTarget(null);
      fetchData();
    }
    setDeleting(false);
  }

  function togglePage(slug: string) {
    setRolePages((prev) =>
      prev.includes(slug) ? prev.filter((p) => p !== slug) : [...prev, slug]
    );
  }

  if (!user?.isSuperAdmin) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-dim">
          <Shield className="w-5 h-5 text-cyan" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">إدارة المستخدمين</h2>
          <p className="text-sm text-muted-foreground">إدارة الأدوار والمستخدمين في النظام</p>
        </div>
      </div>

      <Tabs defaultValue="roles">
        <TabsList>
          <TabsTrigger value="roles">
            <KeyRound className="w-4 h-4 ml-1.5" />
            الأدوار
          </TabsTrigger>
          <TabsTrigger value="users">
            <Users className="w-4 h-4 ml-1.5" />
            المستخدمون
          </TabsTrigger>
        </TabsList>

        {/* ============ ROLES TAB ============ */}
        <TabsContent value="roles">
          <div className="rounded-2xl border border-white/6 bg-white/[0.02] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-white/6">
              <h3 className="text-sm font-semibold text-foreground">الأدوار ({roles.length})</h3>
              <Button size="sm" onClick={() => openRoleDialog()}>
                <Plus className="w-4 h-4 ml-1" />
                دور جديد
              </Button>
            </div>

            {loading ? (
              <div className="p-8 text-center text-muted-foreground text-sm">جاري التحميل...</div>
            ) : roles.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">لا توجد أدوار</div>
            ) : (
              <div className="divide-y divide-white/6">
                {roles.map((role) => (
                  <div key={role.id} className="flex items-center gap-4 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{role.name}</p>
                        <span className="text-[10px] text-muted-foreground font-mono bg-white/[0.04] px-1.5 py-0.5 rounded">{role.slug}</span>
                        {role.is_system && (
                          <Badge variant="outline" className="text-[10px]">نظام</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="text-[11px] text-muted-foreground">
                          {role.organizations?.name_ar || "عام"}
                        </span>
                        <span className="text-white/10">·</span>
                        <span className="text-[11px] text-muted-foreground">
                          {role.allowed_pages.length} صفحة
                        </span>
                      </div>
                    </div>
                    {!role.is_system && (
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => openRoleDialog(role)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            setDeleteTarget({ type: "role", id: role.id, name: role.name });
                            setDeleteOpen(true);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ============ USERS TAB ============ */}
        <TabsContent value="users">
          <div className="rounded-2xl border border-white/6 bg-white/[0.02] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-white/6">
              <h3 className="text-sm font-semibold text-foreground">المستخدمون ({users.length})</h3>
              <Button size="sm" onClick={() => openUserDialog()}>
                <Plus className="w-4 h-4 ml-1" />
                مستخدم جديد
              </Button>
            </div>

            {loading ? (
              <div className="p-8 text-center text-muted-foreground text-sm">جاري التحميل...</div>
            ) : users.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">لا يوجد مستخدمون</div>
            ) : (
              <div className="divide-y divide-white/6">
                {users.map((u) => (
                  <div key={u.id} className="flex items-center gap-4 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                    <div className="w-9 h-9 rounded-xl bg-cyan-dim flex items-center justify-center text-cyan text-xs font-bold ring-1 ring-cyan/20 shrink-0">
                      {u.name?.[0] || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{u.name}</p>
                        {u.is_super_admin && (
                          <Badge variant="outline" className="text-[10px] border-cyan/30 text-cyan">مدير عام</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-[11px] text-muted-foreground">{u.email}</span>
                        <span className="text-white/10">·</span>
                        <span className="text-[11px] text-muted-foreground">{u.roles?.name}</span>
                        <span className="text-white/10">·</span>
                        <span className="text-[11px] text-muted-foreground">{u.organizations?.name_ar}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => openUserDialog(u)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      {u.id !== user?.id && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            setDeleteTarget({ type: "user", id: u.id, name: u.name });
                            setDeleteOpen(true);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ============ ROLE DIALOG ============ */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRole ? "تعديل الدور" : "دور جديد"}</DialogTitle>
            <DialogDescription>
              {editingRole ? "تعديل اسم الدور والصلاحيات" : "إنشاء دور جديد مع تحديد الصفحات المسموح بها"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>اسم الدور</Label>
                <Input
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  placeholder="مثال: مدير المبيعات"
                />
              </div>
              <div className="space-y-1.5">
                <Label>المعرف (slug)</Label>
                <Input
                  value={roleSlug}
                  onChange={(e) => setRoleSlug(e.target.value)}
                  placeholder="sales_manager"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>المنظمة</Label>
              <Select value={roleOrgId || "__global"} onValueChange={(v) => setRoleOrgId(v === "__global" ? "" : (v ?? ""))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__global">عام (جميع المنظمات)</SelectItem>
                  {orgs.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.nameAr}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>الصفحات المسموح بها</Label>
              <div className="grid grid-cols-3 gap-2">
                {ALL_PAGES.map((page) => (
                  <button
                    key={page.slug}
                    type="button"
                    onClick={() => togglePage(page.slug)}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-xs font-medium transition-all text-right",
                      rolePages.includes(page.slug)
                        ? "bg-cyan/15 border-cyan/30 text-cyan"
                        : "bg-white/[0.02] border-white/6 text-muted-foreground hover:bg-white/[0.04]"
                    )}
                  >
                    {page.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={saveRole} disabled={roleSaving || !roleName || !roleSlug || rolePages.length === 0}>
              {roleSaving ? "جاري الحفظ..." : editingRole ? "حفظ التعديلات" : "إنشاء الدور"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ USER DIALOG ============ */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUser ? "تعديل المستخدم" : "مستخدم جديد"}</DialogTitle>
            <DialogDescription>
              {editingUser ? "تعديل بيانات المستخدم" : "إنشاء مستخدم جديد في النظام"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>الاسم</Label>
              <Input
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="اسم المستخدم"
              />
            </div>

            <div className="space-y-1.5">
              <Label>البريد الإلكتروني</Label>
              <Input
                type="email"
                dir="ltr"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>

            {!editingUser && (
              <div className="space-y-1.5">
                <Label>كلمة المرور</Label>
                <Input
                  type="password"
                  dir="ltr"
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>المنظمة</Label>
                <Select value={userOrgId} onValueChange={(v) => v && setUserOrgId(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="اختر المنظمة">
                      {orgs.find((o) => o.id === userOrgId)?.nameAr || "اختر المنظمة"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {orgs.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.nameAr}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>الدور</Label>
                <Select value={userRoleId} onValueChange={(v) => v && setUserRoleId(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="اختر الدور">
                      {roles.find((r) => r.id === userRoleId)?.name || "اختر الدور"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {roles.filter((r) => !r.is_system).map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={saveUser}
              disabled={userSaving || !userName || !userEmail || !userOrgId || !userRoleId || (!editingUser && !userPassword)}
            >
              {userSaving ? "جاري الحفظ..." : editingUser ? "حفظ التعديلات" : "إنشاء المستخدم"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ DELETE DIALOG ============ */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف {deleteTarget?.type === "role" ? "الدور" : "المستخدم"} &quot;{deleteTarget?.name}&quot;؟
              لا يمكن التراجع عن هذا الإجراء.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>إلغاء</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "جاري الحذف..." : "حذف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
