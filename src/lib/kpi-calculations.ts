export interface StageCredit {
  userId: string;
  userName: string;
  stageNumber: number;
  stageName: string;
  weight: number;
  creditPoints: number;
}

export interface EmployeeKPI {
  userId: string;
  userName: string;
  leadsOpened: number;
  stagesCompleted: number;
  dealsClosed: number;
  totalCreditPoints: number;
  totalDealValue: number;
  conversionRate: number;
}

const STAGE_NAMES: Record<number, string> = {
  1: "أول تواصل",
  2: "تأهيل وعرض",
  3: "اختيار الباقة",
  4: "الدفع",
  5: "تأكيد التسجيل",
};

export function getStageName(num: number): string {
  return STAGE_NAMES[num] || "";
}

export function calculateDealCredits(
  stages: { userId: string; userName: string; stageNumber: number; weight: number }[],
  dealValue: number
): StageCredit[] {
  return stages
    .filter((s) => s.userId)
    .map((s) => ({
      ...s,
      stageName: getStageName(s.stageNumber),
      creditPoints: (s.weight / 100) * dealValue,
    }));
}

export function aggregateEmployeeCredits(
  leads: { deal_value: number; stages: { stage_number: number; stage_weight: number; assigned_to: string; assigned_name: string; completed_at: string | null }[] }[]
): EmployeeKPI[] {
  const map = new Map<string, EmployeeKPI>();

  leads.forEach((lead) => {
    (lead.stages || []).forEach((stage) => {
      if (!stage.assigned_to || !stage.completed_at) return;

      const key = stage.assigned_to;
      const existing = map.get(key) || {
        userId: key,
        userName: stage.assigned_name,
        leadsOpened: 0,
        stagesCompleted: 0,
        dealsClosed: 0,
        totalCreditPoints: 0,
        totalDealValue: 0,
        conversionRate: 0,
      };

      existing.stagesCompleted += 1;
      existing.totalCreditPoints += (stage.stage_weight / 100) * (lead.deal_value || 0);
      if (stage.stage_number === 1) existing.leadsOpened += 1;
      if (stage.stage_number === 4) {
        existing.dealsClosed += 1;
        existing.totalDealValue += lead.deal_value || 0;
      }

      map.set(key, existing);
    });
  });

  const result = Array.from(map.values());
  result.forEach((emp) => {
    emp.conversionRate = emp.leadsOpened > 0 ? Math.round((emp.dealsClosed / emp.leadsOpened) * 100) : 0;
  });

  return result.sort((a, b) => b.totalCreditPoints - a.totalCreditPoints);
}
