-- =============================================
-- RLS Policy لجدول deals بناءً على نظام الصلاحيات
-- ⚠️ لا تنفّذ هذا الملف تلقائياً — شغّله يدوياً بعد التأكد من عمل نظام الصلاحيات
-- =============================================

-- عمود التاريخ: deal_date
-- عمود المندوب: assigned_rep_id

DROP POLICY IF EXISTS deals_governance_visibility ON deals;

CREATE POLICY deals_governance_visibility ON deals
  FOR SELECT USING (
    -- المشرفين العامين يشوفون كل شي
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_super_admin = true)
    OR
    -- صفقاتي في الشهر الحالي (غير مكتملة)
    (assigned_rep_id = auth.uid()::text
      AND deal_date >= DATE_TRUNC('month', NOW())::date
      AND stage != 'مكتملة'
      AND has_permission(auth.uid(), 'view_own_current'))
    OR
    -- صفقاتي المكتملة في الشهر الحالي
    (assigned_rep_id = auth.uid()::text
      AND deal_date >= DATE_TRUNC('month', NOW())::date
      AND stage = 'مكتملة'
      AND has_permission(auth.uid(), 'view_own_completed'))
    OR
    -- صفقاتي المعلقة من شهور سابقة
    (assigned_rep_id = auth.uid()::text
      AND deal_date < DATE_TRUNC('month', NOW())::date
      AND stage != 'مكتملة'
      AND has_permission(auth.uid(), 'view_own_pending_old'))
    OR
    -- كل تاريخ صفقاتي
    (assigned_rep_id = auth.uid()::text
      AND has_permission(auth.uid(), 'view_own_history'))
    OR
    -- صفقات الفريق في الشهر الحالي
    (assigned_rep_id != auth.uid()::text
      AND deal_date >= DATE_TRUNC('month', NOW())::date
      AND has_permission(auth.uid(), 'view_team_current'))
    OR
    -- كل تاريخ صفقات الفريق
    (assigned_rep_id != auth.uid()::text
      AND has_permission(auth.uid(), 'view_team_history'))
  );
