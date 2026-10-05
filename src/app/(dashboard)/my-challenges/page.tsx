"use client";

import { ChallengesHub } from "@/components/daily-huddle/challenges-hub";

// انتقلت إلى تبويب «التحديات والطلبات والتطويرات» في المتابعة اليومية — تبقى هنا للروابط القديمة.
export default function MyChallengesPage() {
  return (
    <div className="max-w-4xl mx-auto pb-16">
      <ChallengesHub />
    </div>
  );
}
