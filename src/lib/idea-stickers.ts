// «أفكار» — لوحة استكرات مشتركة للفريق. أنواع وثوابت مشتركة بين الواجهة والـAPI.

export type StickerKind = "star" | "note" | "circle";

export interface IdeaSticker {
  id: string;
  kind: StickerKind;
  tag: string;
  title: string;
  body: string;
  sort_order: number;
  likes: string[];
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export const STICKER_KINDS: { value: StickerKind; label: string; tag: string; swatch: string; ink: string }[] = [
  { value: "star", label: "فكرة خاطفة", tag: "⚡ فكرة خاطفة", swatch: "#fef08a", ink: "#713f12" },
  { value: "note", label: "تذكير", tag: "📌 تذكير", swatch: "#fbcfe8", ink: "#831843" },
  { value: "circle", label: "اقتراح", tag: "💡 اقتراح", swatch: "#a7f3d0", ink: "#064e3b" },
];

export const isStickerKind = (v: unknown): v is StickerKind => v === "star" || v === "note" || v === "circle";
export const stickerKind = (k: string) => STICKER_KINDS.find((x) => x.value === k) ?? STICKER_KINDS[0];
