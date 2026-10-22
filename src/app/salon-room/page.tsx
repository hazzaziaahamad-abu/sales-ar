import type { Metadata } from "next";
import SalonRoom from "@/components/salon-room/SalonRoom";

export const metadata: Metadata = {
  title: "غرفة التخطيط والتنفيذ — مستشارو الصالونات",
  description: "مساحة فريق مستشاري الصالونات لتنفيذ آلية العميل: لوحة المراحل، مهام الأسبوع، دليل الآلية، والفريق.",
  robots: { index: false, follow: false },
};

export default function SalonRoomPage() {
  return <SalonRoom />;
}
