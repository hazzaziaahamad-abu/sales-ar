import { NextRequest, NextResponse } from "next/server";
import { generateImage, type ImageAspect, type InlineImage } from "@/lib/ai/gemini";

// يولّد صورة خلفية البوست (بدون أي كتابة) — الكلام واللوقو تضيفها المنصة فوقها عشان العربي يطلع سليم.

export const maxDuration = 60;

const ASPECT: Record<string, ImageAspect> = { square: "1:1", portrait: "4:5", story: "9:16" };

const isImg = (i: unknown): i is InlineImage =>
  !!i && typeof (i as InlineImage).data === "string" && /^image\//.test(String((i as InlineImage).mimeType));

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const scene = String(body.prompt || "").trim().slice(0, 1500);
    if (!scene) return NextResponse.json({ error: "اكتب وصف الصورة" }, { status: 400 });
    const aspect = ASPECT[body.size] ?? "4:5";
    const textSide = body.textSide === "bottom" ? "bottom" : body.textSide === "none" ? "none" : "top";

    const images: InlineImage[] = [];
    const notes: string[] = [];
    if (isImg(body.screen)) {
      images.push(body.screen);
      notes.push(
        `Image #${images.length} is a real app screenshot (a digital restaurant menu). If a phone, tablet or screen appears in the scene, its display must show EXACTLY this screenshot, sharp, upright and undistorted — do not redraw or invent its contents.`
      );
    }
    if (isImg(body.styleRef)) {
      images.push(body.styleRef);
      notes.push(
        `Image #${images.length} is a style reference only: match its photographic mood, lighting, color grading and camera framing. Do NOT copy any of its text, logos, brand marks or UI.`
      );
    }

    const prompt = [
      "Create a premium, photorealistic advertising photograph for a Saudi social media post (Instagram).",
      `Scene: ${scene}`,
      "Style: high-end commercial photography, cinematic warm lighting, shallow depth of field, rich but natural colors, modern Saudi setting. People (if any) wear authentic Saudi attire (white thobe, red-white shemagh) and look natural and friendly.",
      textSide === "top"
        ? "Composition: keep the TOP 35% of the frame calm and uncluttered (soft background / bokeh) because a large headline will be placed there. Main subject in the lower-middle."
        : textSide === "bottom"
          ? "Composition: keep the BOTTOM 35% of the frame calm and uncluttered because text will be placed there. Main subject in the upper-middle."
          : "Composition: centered subject with breathing room around it.",
      "ABSOLUTELY NO text, letters, numbers, words, logos, watermarks or captions anywhere in the image (except the provided screenshot on a device screen).",
      ...notes,
    ].join("\n");

    const img = await generateImage(prompt, images, aspect);
    return NextResponse.json({ image: `data:${img.mimeType};base64,${img.data}` });
  } catch (error) {
    console.error("design-photo error:", error);
    return NextResponse.json({ error: "تعذّر توليد الصورة — جرّب مرة ثانية أو ارفع صورة" }, { status: 500 });
  }
}
