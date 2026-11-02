// خطوط الاستوديو — ملفات محلية في /public/fonts (مو من Google) عشان التصدير ما يطلع بخط بديل.
// نفس القائمة تُستخدم للمعاينة (روابط عادية) وللتصدير (data URL مضمّنة داخل الـ PNG).

export const FONT_TAJAWAL = "'StudioTajawal', 'Tajawal', sans-serif";
export const FONT_LEXEND = "'StudioLexend', 'Lexend', 'StudioTajawal', sans-serif";

const AR_RANGE =
  "U+0600-06FF,U+0750-077F,U+0870-088E,U+0890-0891,U+0897-08E1,U+08E3-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC";
const LATIN_RANGE =
  "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";

interface Face { family: string; weight: number; file: string; range: string }

export const FONT_FACES: Face[] = [
  ...[400, 500, 700, 800, 900].flatMap((w) => [
    { family: "StudioTajawal", weight: w, file: `/fonts/tajawal-arabic-${w}-normal.woff2`, range: AR_RANGE },
    { family: "StudioTajawal", weight: w, file: `/fonts/tajawal-latin-${w}-normal.woff2`, range: LATIN_RANGE },
  ]),
  { family: "StudioLexend", weight: 600, file: "/fonts/lexend-latin-600-normal.woff2", range: LATIN_RANGE },
  { family: "StudioLexend", weight: 700, file: "/fonts/lexend-latin-700-normal.woff2", range: LATIN_RANGE },
];

export function fontFaceCSS(srcOf: (f: Face) => string = (f) => f.file): string {
  return FONT_FACES.map(
    (f) =>
      `@font-face{font-family:'${f.family}';font-style:normal;font-weight:${f.weight};font-display:block;` +
      `src:url(${srcOf(f)}) format('woff2');unicode-range:${f.range};}`
  ).join("\n");
}

let embedded: Promise<string> | null = null;

/** CSS الخطوط بصيغة data URL — يمرّر لـ html-to-image (fontEmbedCSS) فيضمن الخط الصحيح في الصورة. */
export function embeddedFontCSS(): Promise<string> {
  if (!embedded) {
    embedded = (async () => {
      const urls = await Promise.all(
        FONT_FACES.map(async (f) => {
          const blob = await (await fetch(f.file)).blob();
          return new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result).replace(/^data:[^;]*;/, "data:font/woff2;"));
            r.onerror = () => reject(r.error);
            r.readAsDataURL(blob);
          });
        })
      );
      return fontFaceCSS((f) => urls[FONT_FACES.indexOf(f)]);
    })().catch((e) => {
      embedded = null;
      throw e;
    });
  }
  return embedded;
}

/** يحمّل كل أوزان الخطوط فعلياً (المتصفح ما يحمّل الخط إلا لما يُستخدم). */
export async function loadStudioFonts(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  await Promise.all(
    FONT_FACES.map((f) =>
      document.fonts.load(`${f.weight} 40px '${f.family}'`, f.range === AR_RANGE ? "عربي" : "MENU 123").catch(() => undefined)
    )
  );
  await document.fonts.ready;
}
