// قراءة محتوى «مسار الاتصال» المعدَّل للصفحة العامة (/flow) بدون تسجيل دخول.
export const PUBLIC_CONTENT_KEYS = ["contact_flow_menu", "customer_faq_menu"] as const;

export async function fetchPublicContent<T = unknown>(key: string): Promise<T | null> {
  const res = await fetch(`/api/public/contact-flow?key=${encodeURIComponent(key)}`);
  if (!res.ok) return null;
  const json = await res.json();
  return (json?.value as T) ?? null;
}
