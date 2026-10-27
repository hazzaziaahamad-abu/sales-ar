import type { Metadata } from "next";
import SalonRoom from "@/components/salon-room/SalonRoom";

export const metadata: Metadata = {
  title: "إدارة مستشاري الصالونات",
  description: "إدارة فريق مستشاري الصالونات: التخطيط والتنفيذ، الاستهداف، جدول المهام، دليل الآلية، والفريق.",
  robots: { index: false, follow: false },
};

export default function SalonRoomPage() {
  return <SalonRoom />;
}
