-- إيقاف/تفعيل حساب الموظف من «إدارة المستخدمين» (الإيقاف يحظر الدخول في Supabase Auth أيضاً)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
