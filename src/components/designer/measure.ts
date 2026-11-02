// فحص طول النص داخل القالب الحقيقي: لو نص أطول من مساحته يظهر تحذير جنب الحقل بدل ما ينقص.
// العناصر معلّمة بـ data-fit="المفتاح" و data-fit-lines="أقصى عدد أسطر"، ومنطقة المحتوى بـ data-flow.

export type FitWarnings = Record<string, string>;
export const FLOW_KEY = "__flow";

export function measureFit(root: HTMLElement | null): FitWarnings {
  const out: FitWarnings = {};
  if (!root) return out;

  root.querySelectorAll<HTMLElement>("[data-fit]").forEach((el) => {
    const key = el.dataset.fit!;
    const max = Number(el.dataset.fitLines || 0);
    const cs = getComputedStyle(el);
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3;
    // ارتفاع المحتوى (offsetHeight مستقل عن التصغير transform)
    const lines = Math.round((el.offsetHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) / lh);
    if (el.scrollWidth > el.clientWidth + 1) {
      out[key] = "النص أعرض من مساحته";
    } else if (max > 0 && lines > max) {
      out[key] = max === 1 ? "النص أطول من السطر — بينكسر لسطرين" : `النص طويل — ${lines} أسطر (الحد ${max})`;
    }
  });

  root.querySelectorAll<HTMLElement>("[data-flow]").forEach((el) => {
    if (el.scrollHeight > el.clientHeight + 2) out[FLOW_KEY] = "المحتوى أطول من البوست — بعض المزايا بتنقص. اختصر أو احذف عناصر.";
  });

  return out;
}
