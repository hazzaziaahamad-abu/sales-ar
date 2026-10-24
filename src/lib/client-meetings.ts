// «خطة اجتماع العميل» — ثوابت مشتركة بين مسارات API وصفحة التقرير.

export const ORG_PRODUCT: Record<string, "menu" | "nahjez"> = {
  "00000000-0000-0000-0000-000000000001": "menu",
  "00000000-0000-0000-0000-000000000002": "nahjez",
};

export const PRODUCT_LABEL: Record<string, string> = { menu: "قائمة الطلبات", nahjez: "نحجز" };

/** مراحل الصفقة اللي تعني إن العميل وافق. */
export const CONVERTED_STAGES = ["مكتملة", "انتظار الدفع", "تجهيز"];
export const LOST_STAGES = ["مرفوض مع سبب", "استهداف خاطئ", "كنسل التجربة"];

export type MeetingOutcome = "converted" | "lost" | "open";

/** تحوّل = الصفقة صارت «موافق» بعد الاجتماع (ما كانت موافقة وقت إنشائه). */
export function meetingOutcome(stageAtStart: string | null, currentStage: string | null): MeetingOutcome {
  if (currentStage && CONVERTED_STAGES.includes(currentStage) && !(stageAtStart && CONVERTED_STAGES.includes(stageAtStart))) {
    return "converted";
  }
  if (currentStage && LOST_STAGES.includes(currentStage)) return "lost";
  return "open";
}

export type ClientMeetingRow = {
  id: string;
  org_id: string;
  deal_id: string | null;
  token: string;
  product: string;
  client_name: string;
  client_phone: string | null;
  rep_id: string | null;
  rep_name: string | null;
  stage_at_start: string | null;
  tier_name: string | null;
  open_count: number;
  first_opened_at: string | null;
  last_opened_at: string | null;
  created_at: string;
  current_stage?: string | null;
  outcome?: MeetingOutcome;
};
