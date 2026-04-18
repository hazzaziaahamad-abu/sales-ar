import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Modal, TextInput,
  ScrollView, Alert, Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fetchDeals, createDeal, updateDeal, deleteDeal, fetchEmployees } from "../lib/db";
import { formatMoney, formatDate, formatPhone } from "../lib/format";
import { STAGES, SOURCES, PLANS, STAGE_COLORS } from "../lib/constants";
import { colors } from "../theme/colors";
import type { Deal, Employee } from "../types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

type Props = NativeStackScreenProps<any> & { salesType: "office" | "support" };

const EMPTY_FORM = {
  client_name: "",
  client_phone: "",
  deal_value: "",
  source: "حملة اعلانية",
  stage: "قيد التواصل",
  plan: "",
  assigned_rep_name: "",
  notes: "",
  probability: "50",
};

export default function SalesScreen({ salesType }: Props) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);

  const title = salesType === "office" ? "مبيعات المكتب" : "مبيعات الدعم";
  const accentColor = salesType === "office" ? colors.green : colors.orange;

  const loadData = useCallback(async () => {
    try {
      const [d, e] = await Promise.all([fetchDeals(salesType), fetchEmployees()]);
      setDeals(d);
      setEmployees(e);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [salesType]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  function openCreate() {
    setEditingDeal(null);
    setForm(EMPTY_FORM);
    setModalVisible(true);
  }

  function openEdit(deal: Deal) {
    setEditingDeal(deal);
    setForm({
      client_name: deal.client_name,
      client_phone: deal.client_phone || "",
      deal_value: String(deal.deal_value || 0),
      source: deal.source || "حملة اعلانية",
      stage: deal.stage || "قيد التواصل",
      plan: deal.plan || "",
      assigned_rep_name: deal.assigned_rep_name || "",
      notes: deal.notes || "",
      probability: String(deal.probability || 50),
    });
    setModalVisible(true);
  }

  async function handleSave() {
    if (!form.client_name.trim()) {
      Alert.alert("خطأ", "اسم العميل مطلوب");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        client_name: form.client_name.trim(),
        client_phone: form.client_phone.trim() || undefined,
        deal_value: Number(form.deal_value) || 0,
        source: form.source,
        stage: form.stage,
        plan: form.plan || undefined,
        assigned_rep_name: form.assigned_rep_name || undefined,
        notes: form.notes || undefined,
        probability: Number(form.probability) || 50,
        sales_type: salesType,
        cycle_days: editingDeal?.cycle_days || 0,
        deal_date: editingDeal?.deal_date || new Date().toISOString().slice(0, 10),
      };

      if (editingDeal) {
        await updateDeal(editingDeal.id, payload);
      } else {
        await createDeal(payload as any);
      }
      setModalVisible(false);
      loadData();
    } catch (err) {
      Alert.alert("خطأ", "حدث خطأ أثناء الحفظ");
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    if (!editingDeal) return;
    Alert.alert("تأكيد الحذف", `هل تريد حذف صفقة ${editingDeal.client_name}؟`, [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف", style: "destructive",
        onPress: async () => {
          await deleteDeal(editingDeal.id);
          setModalVisible(false);
          loadData();
        },
      },
    ]);
  }

  const filtered = filter ? deals.filter(d => d.stage === filter) : deals;

  const stages = [...new Set(deals.map(d => d.stage))];

  function renderDealCard({ item: deal }: { item: Deal }) {
    const stageColor = STAGE_COLORS[deal.stage] || colors.textMuted;
    return (
      <TouchableOpacity style={styles.card} onPress={() => openEdit(deal)} activeOpacity={0.7}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            {deal.client_code && (
              <Text style={styles.clientCode}>{deal.client_code}</Text>
            )}
            <Text style={styles.cardName} numberOfLines={1}>{deal.client_name}</Text>
          </View>
          <Text style={[styles.cardValue, { color: accentColor }]}>
            {formatMoney(deal.deal_value)}
          </Text>
        </View>
        <View style={styles.cardBody}>
          <View style={[styles.badge, { backgroundColor: `${stageColor}15` }]}>
            <View style={[styles.badgeDot, { backgroundColor: stageColor }]} />
            <Text style={[styles.badgeText, { color: stageColor }]}>{deal.stage}</Text>
          </View>
          {deal.assigned_rep_name ? (
            <Text style={styles.repName}>{deal.assigned_rep_name}</Text>
          ) : null}
          {deal.plan ? (
            <View style={[styles.badge, { backgroundColor: colors.purpleDim }]}>
              <Text style={[styles.badgeText, { color: colors.purple }]}>{deal.plan}</Text>
            </View>
          ) : null}
        </View>
        {deal.client_phone ? (
          <TouchableOpacity
            style={styles.phoneRow}
            onPress={() => Linking.openURL(`tel:${deal.client_phone}`)}
          >
            <Ionicons name="call-outline" size={13} color={colors.primary} />
            <Text style={styles.phoneText}>{formatPhone(deal.client_phone)}</Text>
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{title}</Text>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: `${accentColor}15` }]} onPress={openCreate}>
          <Ionicons name="add" size={22} color={accentColor} />
        </TouchableOpacity>
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.miniStat}>
          <Text style={styles.miniStatValue}>{deals.length}</Text>
          <Text style={styles.miniStatLabel}>الكل</Text>
        </View>
        <View style={styles.miniStat}>
          <Text style={[styles.miniStatValue, { color: colors.green }]}>
            {deals.filter(d => d.stage === "مكتملة").length}
          </Text>
          <Text style={styles.miniStatLabel}>مكتملة</Text>
        </View>
        <View style={styles.miniStat}>
          <Text style={[styles.miniStatValue, { color: colors.amber }]}>
            {deals.filter(d => d.stage === "انتظار الدفع").length}
          </Text>
          <Text style={styles.miniStatLabel}>انتظار</Text>
        </View>
        <View style={styles.miniStat}>
          <Text style={[styles.miniStatValue, { color: colors.primary }]}>
            {formatMoney(deals.reduce((s, d) => s + d.deal_value, 0))}
          </Text>
          <Text style={styles.miniStatLabel}>الإجمالي</Text>
        </View>
      </View>

      {/* Stage Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}>
        <TouchableOpacity
          style={[styles.filterChip, !filter && styles.filterChipActive]}
          onPress={() => setFilter(null)}
        >
          <Text style={[styles.filterChipText, !filter && styles.filterChipTextActive]}>الكل</Text>
        </TouchableOpacity>
        {stages.map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.filterChip, filter === s && styles.filterChipActive]}
            onPress={() => setFilter(filter === s ? null : s)}
          >
            <Text style={[styles.filterChipText, filter === s && styles.filterChipTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Deals List */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={renderDealCard}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="folder-open-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>لا توجد صفقات</Text>
          </View>
        }
      />

      {/* Create/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingDeal ? "تعديل الصفقة" : "إضافة صفقة جديدة"}
            </Text>
            {editingDeal ? (
              <TouchableOpacity onPress={handleDelete}>
                <Ionicons name="trash-outline" size={22} color={colors.red} />
              </TouchableOpacity>
            ) : <View style={{ width: 24 }} />}
          </View>

          <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Client Name */}
            <Text style={styles.fieldLabel}>اسم العميل *</Text>
            <TextInput
              style={styles.fieldInput}
              value={form.client_name}
              onChangeText={v => setForm({ ...form, client_name: v })}
              placeholder="أدخل اسم العميل"
              placeholderTextColor={colors.textMuted}
              textAlign="right"
            />

            {/* Phone */}
            <Text style={styles.fieldLabel}>رقم الجوال</Text>
            <TextInput
              style={styles.fieldInput}
              value={form.client_phone}
              onChangeText={v => setForm({ ...form, client_phone: v })}
              placeholder="05xxxxxxxx"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              textAlign="left"
            />

            {/* Value */}
            <Text style={styles.fieldLabel}>قيمة الصفقة (ر.س)</Text>
            <TextInput
              style={styles.fieldInput}
              value={form.deal_value}
              onChangeText={v => setForm({ ...form, deal_value: v })}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              textAlign="left"
            />

            {/* Stage */}
            <Text style={styles.fieldLabel}>المرحلة</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }} contentContainerStyle={{ gap: 6 }}>
              {STAGES.map(s => {
                const active = form.stage === s;
                const sc = STAGE_COLORS[s] || colors.textMuted;
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.selectChip, active && { backgroundColor: `${sc}25`, borderColor: `${sc}50` }]}
                    onPress={() => setForm({ ...form, stage: s })}
                  >
                    <Text style={[styles.selectChipText, active && { color: sc }]}>{s}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Source */}
            <Text style={styles.fieldLabel}>المصدر</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }} contentContainerStyle={{ gap: 6 }}>
              {SOURCES.map(s => {
                const active = form.source === s;
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.selectChip, active && { backgroundColor: colors.primaryDim, borderColor: `${colors.primary}50` }]}
                    onPress={() => setForm({ ...form, source: s })}
                  >
                    <Text style={[styles.selectChipText, active && { color: colors.primary }]}>{s}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Plan */}
            <Text style={styles.fieldLabel}>الباقة</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }} contentContainerStyle={{ gap: 6 }}>
              {PLANS.map(p => {
                const active = form.plan === p;
                return (
                  <TouchableOpacity
                    key={p}
                    style={[styles.selectChip, active && { backgroundColor: colors.purpleDim, borderColor: `${colors.purple}50` }]}
                    onPress={() => setForm({ ...form, plan: active ? "" : p })}
                  >
                    <Text style={[styles.selectChipText, active && { color: colors.purple }]}>{p}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Rep */}
            <Text style={styles.fieldLabel}>المسؤول</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }} contentContainerStyle={{ gap: 6 }}>
              {employees.map(e => {
                const active = form.assigned_rep_name === e.name;
                return (
                  <TouchableOpacity
                    key={e.id}
                    style={[styles.selectChip, active && { backgroundColor: colors.blueDim, borderColor: `${colors.blue}50` }]}
                    onPress={() => setForm({ ...form, assigned_rep_name: active ? "" : e.name })}
                  >
                    <Text style={[styles.selectChipText, active && { color: colors.blue }]}>{e.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Notes */}
            <Text style={styles.fieldLabel}>ملاحظات</Text>
            <TextInput
              style={[styles.fieldInput, { height: 80, textAlignVertical: "top" }]}
              value={form.notes}
              onChangeText={v => setForm({ ...form, notes: v })}
              placeholder="أضف ملاحظات..."
              placeholderTextColor={colors.textMuted}
              multiline
              textAlign="right"
            />
          </ScrollView>

          {/* Save Button */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: accentColor }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>
                  {editingDeal ? "تحديث" : "إضافة"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: {
    flex: 1, backgroundColor: colors.background,
    justifyContent: "center", alignItems: "center",
  },
  header: {
    flexDirection: "row-reverse", justifyContent: "space-between",
    alignItems: "center", paddingHorizontal: 16, paddingVertical: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  addBtn: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: "center", alignItems: "center",
  },
  statsBar: {
    flexDirection: "row-reverse", paddingHorizontal: 16,
    gap: 8, marginBottom: 10,
  },
  miniStat: {
    flex: 1, backgroundColor: colors.card, borderRadius: 12,
    padding: 10, borderWidth: 1, borderColor: colors.border,
    alignItems: "center",
  },
  miniStatValue: { fontSize: 14, fontWeight: "800", color: colors.text },
  miniStatLabel: { fontSize: 10, color: colors.textSecondary, marginTop: 2 },
  filterScroll: { marginBottom: 6, maxHeight: 40 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, backgroundColor: colors.inputBg,
    borderWidth: 1, borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primaryDim,
    borderColor: `${colors.primary}40`,
  },
  filterChipText: { fontSize: 12, color: colors.textSecondary },
  filterChipTextActive: { color: colors.primary, fontWeight: "600" },
  card: {
    backgroundColor: colors.card, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: "row-reverse", justifyContent: "space-between",
    alignItems: "flex-start", marginBottom: 8,
  },
  cardTitleRow: { flexDirection: "row-reverse", alignItems: "center", gap: 6, flex: 1 },
  clientCode: {
    fontSize: 10, fontWeight: "700", color: colors.textMuted,
    backgroundColor: colors.inputBg, paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 6, overflow: "hidden",
  },
  cardName: { fontSize: 14, fontWeight: "700", color: colors.text, flex: 1, textAlign: "right" },
  cardValue: { fontSize: 14, fontWeight: "800" },
  cardBody: {
    flexDirection: "row-reverse", flexWrap: "wrap", gap: 6,
  },
  badge: { flexDirection: "row-reverse", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeDot: { width: 5, height: 5, borderRadius: 3 },
  badgeText: { fontSize: 10, fontWeight: "600" },
  repName: { fontSize: 11, color: colors.textSecondary },
  phoneRow: {
    flexDirection: "row-reverse", alignItems: "center", gap: 4,
    marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border,
  },
  phoneText: { fontSize: 12, color: colors.primary },
  emptyState: {
    alignItems: "center", justifyContent: "center", paddingTop: 60,
  },
  emptyText: { fontSize: 14, color: colors.textMuted, marginTop: 12 },
  // Modal
  modalContainer: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: "row-reverse", justifyContent: "space-between",
    alignItems: "center", paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  modalBody: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  fieldLabel: {
    fontSize: 13, fontWeight: "600", color: colors.textSecondary,
    marginBottom: 6, textAlign: "right",
  },
  fieldInput: {
    backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: colors.text, marginBottom: 16,
  },
  selectChip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 10, backgroundColor: colors.inputBg,
    borderWidth: 1, borderColor: colors.border,
  },
  selectChipText: { fontSize: 12, color: colors.textSecondary },
  modalFooter: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  saveBtn: {
    borderRadius: 14, paddingVertical: 14,
    alignItems: "center",
  },
  saveBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
});
