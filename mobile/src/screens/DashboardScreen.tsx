import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../lib/auth-context";
import { fetchDeals, fetchTickets } from "../lib/db";
import { formatMoney, formatMoneyFull } from "../lib/format";
import { STAGE_COLORS } from "../lib/constants";
import { colors } from "../theme/colors";
import type { Deal, Ticket } from "../types";

function StatCard({ icon, iconColor, label, value, bgColor }: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  label: string;
  value: string;
  bgColor: string;
}) {
  return (
    <View style={[styles.statCard, { borderColor: `${iconColor}30` }]}>
      <View style={[styles.statIcon, { backgroundColor: bgColor }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function StageBadge({ stage, count }: { stage: string; count: number }) {
  const color = STAGE_COLORS[stage] || colors.textMuted;
  return (
    <View style={[styles.stageBadge, { backgroundColor: `${color}15`, borderColor: `${color}30` }]}>
      <View style={[styles.stageDot, { backgroundColor: color }]} />
      <Text style={[styles.stageText, { color }]}>{stage}</Text>
      <Text style={[styles.stageCount, { color }]}>{count}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const { user, signOut } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [d, t] = await Promise.all([fetchDeals(), fetchTickets()]);
      setDeals(d);
      setTickets(t);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const monthDeals = deals.filter(d => {
    if (d.month && d.year) return d.month === currentMonth && d.year === currentYear;
    if (d.deal_date) {
      const dd = new Date(d.deal_date);
      return dd.getMonth() + 1 === currentMonth && dd.getFullYear() === currentYear;
    }
    return false;
  });

  const completed = monthDeals.filter(d => d.stage === "مكتملة");
  const totalRevenue = completed.reduce((s, d) => s + d.deal_value, 0);
  const activeDeals = deals.filter(d => d.stage !== "مكتملة" && d.stage !== "مرفوض مع سبب");
  const openTickets = tickets.filter(t => t.status === "مفتوح" || t.status === "قيد الحل");
  const closeRate = monthDeals.length > 0
    ? Math.round((completed.length / monthDeals.length) * 100) : 0;

  const stageMap: Record<string, number> = {};
  activeDeals.forEach(d => { stageMap[d.stage] = (stageMap[d.stage] || 0) + 1; });
  const stageEntries = Object.entries(stageMap).sort((a, b) => b[1] - a[1]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>مرحباً، {user?.name || "مدير"} 👋</Text>
          <Text style={styles.headerSub}>نظرة عامة على الأداء</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={signOut}>
          <Ionicons name="log-out-outline" size={20} color={colors.red} />
        </TouchableOpacity>
      </View>

      {/* Revenue Hero */}
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>إيرادات الشهر</Text>
        <Text style={styles.heroValue}>{formatMoneyFull(totalRevenue)}</Text>
        <View style={styles.heroRow}>
          <View style={styles.heroPill}>
            <Ionicons name="checkmark-circle" size={14} color={colors.green} />
            <Text style={styles.heroPillText}>{completed.length} مكتملة</Text>
          </View>
          <View style={styles.heroPill}>
            <Ionicons name="trending-up" size={14} color={colors.primary} />
            <Text style={styles.heroPillText}>{closeRate}% تحويل</Text>
          </View>
        </View>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <StatCard
          icon="briefcase-outline"
          iconColor={colors.primary}
          bgColor={colors.primaryDim}
          label="صفقات الشهر"
          value={String(monthDeals.length)}
        />
        <StatCard
          icon="alert-circle-outline"
          iconColor={colors.amber}
          bgColor={colors.amberDim}
          label="تذاكر مفتوحة"
          value={String(openTickets.length)}
        />
        <StatCard
          icon="pulse-outline"
          iconColor={colors.green}
          bgColor={colors.greenDim}
          label="صفقات نشطة"
          value={String(activeDeals.length)}
        />
        <StatCard
          icon="cash-outline"
          iconColor={colors.purple}
          bgColor={colors.purpleDim}
          label="متوسط القيمة"
          value={completed.length > 0 ? formatMoney(Math.round(totalRevenue / completed.length)) : "—"}
        />
      </View>

      {/* Pipeline */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>توزيع المراحل</Text>
        <View style={styles.stagesWrap}>
          {stageEntries.map(([stage, count]) => (
            <StageBadge key={stage} stage={stage} count={count} />
          ))}
        </View>
      </View>

      {/* Recent Deals */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>أحدث الصفقات</Text>
        {deals.slice(0, 5).map(deal => {
          const stageColor = STAGE_COLORS[deal.stage] || colors.textMuted;
          return (
            <View key={deal.id} style={styles.dealRow}>
              <View style={styles.dealInfo}>
                <Text style={styles.dealName} numberOfLines={1}>{deal.client_name}</Text>
                <View style={[styles.dealStageBadge, { backgroundColor: `${stageColor}15` }]}>
                  <Text style={[styles.dealStageText, { color: stageColor }]}>{deal.stage}</Text>
                </View>
              </View>
              <Text style={styles.dealValue}>{formatMoney(deal.deal_value)}</Text>
            </View>
          );
        })}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16 },
  loadingContainer: {
    flex: 1, backgroundColor: colors.background,
    justifyContent: "center", alignItems: "center",
  },
  header: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    marginTop: 8,
  },
  greeting: { fontSize: 18, fontWeight: "800", color: colors.text, textAlign: "right" },
  headerSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2, textAlign: "right" },
  logoutBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: colors.redDim,
    justifyContent: "center", alignItems: "center",
  },
  heroCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: `${colors.primary}30`,
    marginBottom: 16,
  },
  heroLabel: { fontSize: 13, color: colors.textSecondary, textAlign: "right" },
  heroValue: {
    fontSize: 28, fontWeight: "900", color: colors.text,
    marginVertical: 8, textAlign: "right",
  },
  heroRow: { flexDirection: "row-reverse", gap: 10 },
  heroPill: {
    flexDirection: "row-reverse", alignItems: "center", gap: 4,
    backgroundColor: colors.inputBg, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20,
  },
  heroPillText: { fontSize: 12, color: colors.textSecondary },
  statsGrid: {
    flexDirection: "row-reverse", flexWrap: "wrap",
    gap: 10, marginBottom: 20,
  },
  statCard: {
    width: "48%",
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    flexGrow: 1,
    flexBasis: "45%",
  },
  statIcon: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: "center", alignItems: "center",
    alignSelf: "flex-end", marginBottom: 10,
  },
  statValue: {
    fontSize: 22, fontWeight: "800", color: colors.text, textAlign: "right",
  },
  statLabel: {
    fontSize: 11, color: colors.textSecondary, marginTop: 2, textAlign: "right",
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 14, fontWeight: "700", color: colors.text,
    marginBottom: 12, textAlign: "right",
  },
  stagesWrap: {
    flexDirection: "row-reverse", flexWrap: "wrap", gap: 8,
  },
  stageBadge: {
    flexDirection: "row-reverse", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1,
  },
  stageDot: { width: 6, height: 6, borderRadius: 3 },
  stageText: { fontSize: 11, fontWeight: "600" },
  stageCount: { fontSize: 12, fontWeight: "800" },
  dealRow: {
    flexDirection: "row-reverse", justifyContent: "space-between",
    alignItems: "center", paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  dealInfo: { flexDirection: "row-reverse", alignItems: "center", gap: 8, flex: 1 },
  dealName: { fontSize: 13, fontWeight: "600", color: colors.text, maxWidth: "50%" },
  dealStageBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  dealStageText: { fontSize: 10, fontWeight: "600" },
  dealValue: { fontSize: 13, fontWeight: "700", color: colors.green },
});
