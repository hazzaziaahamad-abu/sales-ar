"use client";

// قسم مستقل لـ«مسار الاتصال» و«العميل سأل؟» — نفس المحتوى المعروض في خريطة رحلة
// الطلب (وضع الموظف) وبنفس مفاتيح الحفظ، فأي تعديل من المدير يظهر في المكانين.

import { useEffect } from "react";
import { PhoneCall } from "lucide-react";
import ContactFlowPanel from "@/components/sales/ContactFlowPanel";
import CustomerFAQPanel from "@/components/sales/CustomerFAQPanel";
import { CONTACT_FLOW, INTERESTED_FLOW, LOYALTY, CF_TIERS, CUSTOMER_FAQ } from "@/lib/sales/contact-flow-content";

const INK = "#40332b";
const PAPER = "#fbfaf5";
const GRID = "#dbe4f2";
const PURPLE = "#6D28D9";

export default function ContactFlowPage() {
  // ‎#customer-faq‎ ينزل مباشرة للأسئلة.
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash !== "contact-flow" && hash !== "customer-faq") return;
    const t = setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      dir="rtl"
      className="min-h-screen w-full px-4 py-8"
      style={{
        fontFamily: "'Tajawal', system-ui, sans-serif",
        backgroundColor: PAPER,
        backgroundImage: `linear-gradient(${GRID} 1px, transparent 1px), linear-gradient(90deg, ${GRID} 1px, transparent 1px)`,
        backgroundSize: "26px 26px",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lemonada:wght@500;600;700&family=Tajawal:wght@400;500;700;800&display=swap');
        .display { font-family: 'Lemonada', 'Tajawal', cursive; }
        @keyframes modalPop { 0% { opacity: 0; transform: scale(.9) translateY(8px); } 100% { opacity: 1; transform: none; } }
        .modal-pop { animation: modalPop .28s ease both; }
        @media (prefers-reduced-motion: reduce) { .modal-pop { animation: none; } }
      `}</style>

      <header className="mx-auto mb-2 flex max-w-5xl items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: "#EDE9FE" }}>
          <PhoneCall className="h-5 w-5" style={{ color: PURPLE }} />
        </div>
        <div>
          <h1 className="display text-xl font-bold" style={{ color: INK }}>مسار الاتصال</h1>
          <p className="text-sm" style={{ color: "#7a6a5c" }}>
            سكربت المكالمة والواتساب خطوة بخطوة + ردود جاهزة على أسئلة العملاء
          </p>
        </div>
        <nav className="mr-auto flex gap-2 text-sm font-semibold">
          <a href="#contact-flow" className="rounded-lg px-3 py-1.5" style={{ backgroundColor: "#fff", border: "1px solid #e2d3c3", color: INK }}>
            مسار الاتصال
          </a>
          <a href="#customer-faq" className="rounded-lg px-3 py-1.5" style={{ backgroundColor: "#fff", border: "1px solid #e2d3c3", color: INK }}>
            العميل سأل؟
          </a>
        </nav>
      </header>

      <ContactFlowPanel
        id="contact-flow"
        storageKey="contact_flow_menu"
        tiers={CF_TIERS}
        defaultSteps={CONTACT_FLOW}
        defaultLoyalty={LOYALTY}
        defaultInterestedSteps={INTERESTED_FLOW}
      />
      <CustomerFAQPanel id="customer-faq" storageKey="customer_faq_menu" defaultItems={CUSTOMER_FAQ} />
    </div>
  );
}
