-- ─────────────────────────────────────────────────────────────────────────────
-- «معرض شاشات MENU» (/showcase): باقات وأسعار تُعرض للعميل في آخر شريحة.
-- صف واحد لكل منظمة، القائمة كاملة في packages (jsonb مرتّب).
--   القراءة: أعضاء المنظمة (عشان الـ realtime يوصل لكل موظف فاتح الصفحة).
--   الكتابة: لا توجد سياسات كتابة — الحفظ فقط عبر /api/showcase-packages (service role)
--            للسوبر أدمن أو صاحب صلاحية showcase_packages_edit.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.showcase_packages (
  org_id uuid primary key references organizations(id) on delete cascade,
  packages jsonb not null default '[]'::jsonb,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

alter table public.showcase_packages enable row level security;

drop policy if exists showcase_packages_read on public.showcase_packages;
create policy showcase_packages_read on public.showcase_packages
  for select to authenticated
  using (
    exists (
      select 1 from public.user_profiles p
      where p.id = auth.uid()
        and (p.is_super_admin = true
             or p.org_id = showcase_packages.org_id
             or showcase_packages.org_id = any(p.extra_org_ids))
    )
  );

-- التعبئة الأولى من packages.json لكل منظمة.
insert into public.showcase_packages (org_id, packages)
select id, '[{"featured": false, "features": ["رابط منيو إلكتروني مع باركود ( بدون اي اعلانات)", "إضافة وتعديل وإخفاء جميع منتجاتك مع تفاصيلها", "جميع الاشتراطات مثل مسببات الحساسية والسعرات تضيفها بسهولة", "كل الروابط اللي يحتاجها عميلك تقدر تضيفها في المنيو", "مظهر جميل يعكس هوية نشاطك", "صور متحركة إعلانية أعلى المنيو"], "name": "الباقة الأساسية", "period": "ريال / سنة", "price": "349"}, {"featured": true, "features": ["جميع مزايا الباقة الأساسية", "الطلب والدفع من المنيو", "الطلب من باركود الطاولة", "الربط مع بكسل سناب وانستقرام وتيك توك", "التحكم في ظهور المنتجات حسب الوقت", "ظهور المنتجات المفضلة", "إرسال الطلب على الواتساب", "قائمة الانتظار", "التحكم بمظهر المتجر", "فئات رئيسية", "كوبونات الخصم", "حجوزات الطاولات", "استبيان خاص للعملاء", "دومين مخصص", "إضافة الفروع", "تقييمات العملاء"], "name": "باقة VIP", "period": "ريال / سنة", "price": "879"}]'::jsonb
from public.organizations
on conflict (org_id) do nothing;

do $$
begin
  alter publication supabase_realtime add table public.showcase_packages;
exception when duplicate_object then null;
end $$;

-- تسجيل مفتاح الصلاحية ليظهر في صفحة الحوكمة.
do $$
begin
  if to_regclass('public.permission_keys') is not null then
    begin
      insert into public.permission_keys (key, label_ar, description_ar, category, sort_order)
      values ('showcase_packages_edit', 'تعديل باقات معرض MENU',
              'تعديل أسماء وأسعار ومزايا الباقات في صفحة معرض شاشات MENU',
              'governance', 20)
      on conflict do nothing;
    exception when others then
      null; -- اختلاف الأعمدة لا يجب أن يُفشل الهجرة
    end;
  end if;
end $$;
