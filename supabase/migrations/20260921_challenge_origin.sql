-- تمييز مصدر التحدي: من الموظف (employee) أم رفعه المدير بنفسه (manager).
-- يتيح للمدير رفع تحدٍّ إلى الذكاء الاصطناعي مباشرةً من مركز المعالجة.
alter table public.employee_challenges
  add column if not exists origin text not null default 'employee'
    check (origin in ('employee', 'manager'));
