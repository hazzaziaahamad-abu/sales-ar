/**
 * حارس «العرض فقط»: عند دخول الأدمن كموظف (View As) نمنع أي كتابة على قاعدة البيانات.
 * الأعلام تُضبط من AuthContext، وعميل Supabase (client.ts) يستشيرها قبل تنفيذ أي إدراج/تعديل/حذف.
 */

let readOnly = false;

export function setDbReadOnly(value: boolean) {
  readOnly = value;
}

export function isDbReadOnly(): boolean {
  return readOnly;
}

/** رسالة الخطأ المُعادة عند محاولة الكتابة في وضع العرض فقط. */
export const READ_ONLY_ERROR = {
  message: "وضع العرض فقط — التعديلات معطّلة أثناء الدخول كموظف.",
  code: "READ_ONLY",
  details: "",
  hint: "",
};

/**
 * كائن بديل «لا-عملية» قابل للـ await وللتسلسل (select/single/eq/…)، يُرجِع دائماً نتيجة خطأ
 * بدل تنفيذ الكتابة — حتى لا تنكسر السلاسل مثل insert().select().single().
 */
export function readOnlyStub() {
  const result = { data: null, error: READ_ONLY_ERROR } as const;
  const stub: Record<string, unknown> = {
    then: (resolve: (v: typeof result) => unknown) => Promise.resolve(result).then(resolve),
    catch: () => Promise.resolve(result),
    finally: (cb: () => void) => Promise.resolve(result).finally(cb),
  };
  const chainMethods = [
    "select", "single", "maybeSingle", "eq", "neq", "in", "order", "limit",
    "match", "filter", "returns", "throwOnError", "csv", "gte", "lte", "gt",
    "lt", "is", "or", "not", "contains", "range", "abortSignal", "overlaps",
  ];
  for (const m of chainMethods) stub[m] = () => stub;
  return stub;
}
