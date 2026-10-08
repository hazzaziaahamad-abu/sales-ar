-- منع المستخدم من تعديل ملفه بنفسه (كان يقدر يعطي نفسه سوبر أدمن أو منظمات إضافية).
-- كل تعديلات المستخدمين تمر عبر /api/users (سوبر أدمن فقط، بمفتاح الخدمة).
ALTER POLICY update_own_profile ON user_profiles USING (false) WITH CHECK (false);
