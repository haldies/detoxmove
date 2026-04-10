import React, { useState, useCallback } from 'react';
import {
  StyleSheet, View, Text, ScrollView, SafeAreaView,
  ActivityIndicator, NativeModules, Dimensions,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BarChart } from 'react-native-gifted-charts';
import DatabaseService, { UserStats } from '../services/DatabaseService';
import { Colors, Shadows } from '../theme/theme';

const { UsageModule, DetoxService } = NativeModules;
const { width } = Dimensions.get('window');

const CHART_WIDTH = width - 64;
const DAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

export default function ReportScreen() {
  const [loading, setLoading] = useState(true);
  const [todayApps, setTodayApps] = useState<{ name: string; mins: number }[]>([]);
  const [weekStats, setWeekStats] = useState<UserStats[]>([]);
  const [activeTab, setActiveTab] = useState<'langkah' | 'pushups' | 'squats' | 'jumps'>('langkah');

  const fetchData = async () => {
    try {
      setLoading(true);

      const restricted: string[] = await DetoxService.getRestrictedApps();
      const now = Date.now();
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const usage = await UsageModule.getUsageStats(startOfDay.getTime(), now);
      const apps = (usage as any[])
        .filter((a) => restricted.includes(a.packageName))
        .map((a) => ({
          name: a.packageName.split('.').pop() || a.packageName,
          mins: Math.round(a.totalTimeInForeground / 60000),
        }))
        .sort((a, b) => b.mins - a.mins);
      setTodayApps(apps);

      const totalMinsToday = apps.reduce((acc, a) => acc + a.mins, 0);
      await DatabaseService.updateDailyUsage(totalMinsToday);

      const stats = await DatabaseService.getLast7DaysStats();
      setWeekStats(stats);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchData(); }, []));

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 is Sunday, 1 is Monday
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const fullWeek = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key = d.toISOString().split('T')[0];
    const found = weekStats.find((s) => s.date === key);
    return {
      ...(found || { date: key, coins: 0, distance: 0, pushups: 0, squats: 0, jumps: 0, usage_mins: 0 }),
      dayLabel: DAY_LABELS[i]
    };
  });

  const maxUsage = Math.max(...fullWeek.map((s) => s.usage_mins), 1);
  const usageBarData = fullWeek.map((s, i) => ({
    value: s.usage_mins,
    label: s.dayLabel,
    frontColor: s.usage_mins > 0 ? '#FF6B6B' : Colors.border,
    topLabelComponent: s.usage_mins > 0
      ? () => <Text style={styles.barTopLabel}>{s.usage_mins}m</Text>
      : undefined,
  }));

  const getExerciseData = () => {
    let maxValue = 10;
    let color = Colors.primary;
    let unit = 'rep';
    
    if (activeTab === 'langkah') {
      maxValue = Math.max(...fullWeek.map(s => Math.floor((s.distance || 0) * 1312)), 1000);
      color = "#00C6FF";
      unit = 'step';
    } else if (activeTab === 'pushups') {
      maxValue = Math.max(...fullWeek.map(s => s.pushups || 0), 10);
      color = "#14B8A6";
    } else if (activeTab === 'squats') {
      maxValue = Math.max(...fullWeek.map(s => s.squats || 0), 10);
      color = "#A78BFA";
    } else {
      maxValue = Math.max(...fullWeek.map(s => s.jumps || 0), 10);
      color = "#F59E0B";
    }

    const data = fullWeek.map((s, i) => {
      let val = 0;
      if (activeTab === 'langkah') val = Math.floor((s.distance || 0) * 1312);
      else if (activeTab === 'pushups') val = s.pushups || 0;
      else if (activeTab === 'squats') val = s.squats || 0;
      else val = s.jumps || 0;

      return {
        value: val,
        label: s.dayLabel,
        frontColor: val > 0 ? color : Colors.border,
        topLabelComponent: val > 0
          ? () => <Text style={styles.barTopLabel}>{val}{unit === 'step' ? '' : unit}</Text>
          : undefined,
      };
    });

    return { data, maxValue, color };
  };

  const { data: exerciseBarData, maxValue: maxExercises, color: activeColor } = getExerciseData();

  // Total mingguan
  const totalUsageMins = fullWeek.reduce((acc, s) => acc + s.usage_mins, 0);
  const totalRunningKm = (fullWeek.reduce((acc, s) => acc + (s.distance || 0), 0)).toFixed(1);
  const totalLangkah = Math.floor(fullWeek.reduce((acc, s) => acc + (s.distance || 0), 0) * 1312);
  const totalPushups = fullWeek.reduce((acc, s) => acc + s.pushups, 0);
  const barW = Math.floor((CHART_WIDTH - 60) / 7 - 6);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <Text style={styles.title}>Laporan</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Penggunaan Aplikasi</Text>
          <Text style={styles.cardSub}>Total semua app dibatasi per hari</Text>

          <View style={styles.chartWrap}>
            <BarChart
              data={usageBarData}
              width={CHART_WIDTH - 20}
              barWidth={barW}
              barBorderRadius={5}
              maxValue={Math.ceil(maxUsage * 1.3)}
              yAxisThickness={0}
              xAxisThickness={1}
              xAxisColor={Colors.border}
              yAxisTextStyle={{ color: Colors.textSub, fontSize: 9 }}
              xAxisLabelTextStyle={{ color: Colors.textSub, fontSize: 10, fontWeight: '700' }}
              noOfSections={4}
              hideRules
              isAnimated
              animationDuration={600}
              spacing={6}
              initialSpacing={8}
            />
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryVal}>{totalUsageMins}m</Text>
              <Text style={styles.summaryLbl}>Total Minggu</Text>
            </View>
            <View style={[styles.summaryBox, styles.summaryBoxMid]}>
              <Text style={styles.summaryVal}>{todayApps.length}</Text>
              <Text style={styles.summaryLbl}>App Dibatasi</Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryVal}>{todayApps[0]?.mins ?? 0}m</Text>
              <Text style={styles.summaryLbl}>Terbanyak Hari Ini</Text>
            </View>
          </View>

        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Olahraga Mingguan</Text>
          <View style={styles.chartWrap}>
            <BarChart
              data={exerciseBarData}
              width={CHART_WIDTH - 20}
              barWidth={barW}
              barBorderRadius={5}
              maxValue={Math.ceil(maxExercises * 1.3)}
              yAxisThickness={0}
              xAxisThickness={1}
              xAxisColor={Colors.border}
              yAxisTextStyle={{ color: Colors.textSub, fontSize: 9 }}
              xAxisLabelTextStyle={{ color: Colors.textSub, fontSize: 10, fontWeight: '700' }}
              noOfSections={4}
              hideRules
              isAnimated
              animationDuration={600}
              spacing={6}
              initialSpacing={8}
            />
          </View>

          <View style={styles.catGrid}>
            <CatItem 
              color="#00C6FF" 
              label="Langkah" 
              value={`${totalLangkah}`} 
              active={activeTab === 'langkah'}
              onPress={() => setActiveTab('langkah')}
            />
            <CatItem 
              color="#14B8A6" 
              label="Push Up" 
              value={`${totalPushups}`} 
              active={activeTab === 'pushups'}
              onPress={() => setActiveTab('pushups')}
            />
            <CatItem 
              color="#A78BFA" 
              label="Squat" 
              value={`${fullWeek.reduce((acc, s) => acc + (s.squats || 0), 0)}`} 
              active={activeTab === 'squats'}
              onPress={() => setActiveTab('squats')}
            />
            <CatItem 
              color="#F59E0B" 
              label="Jump" 
              value={`${fullWeek.reduce((acc, s) => acc + (s.jumps || 0), 0)}`} 
              active={activeTab === 'jumps'}
              onPress={() => setActiveTab('jumps')}
            />
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function CatItem({ color, label, value, active, onPress }: {
  color: string; label: string; value: string; active?: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity 
      style={[styles.catItem, active && styles.catItemActive]} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.catDot, { backgroundColor: color }]} />
      <View>
        <Text style={styles.catLabel}>{label}</Text>
        <Text style={styles.catValue}>{value}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: { marginBottom: 24 },
  title: { fontSize: 26, fontWeight: '900', color: Colors.textMain },
  subtitle: { fontSize: 13, color: Colors.textSub, marginTop: 4, fontWeight: '600' },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.soft,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: Colors.textMain, marginBottom: 2 },
  cardSub: { fontSize: 12, color: Colors.textSub, fontWeight: '600', marginBottom: 14 },

  chartWrap: { alignItems: 'center', overflow: 'hidden', marginBottom: 14 },
  barTopLabel: { fontSize: 8, color: Colors.textSub, fontWeight: '700', marginBottom: 2 },

  summaryRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 14,
    marginBottom: 14,
  },
  summaryBox: { flex: 1, alignItems: 'center' },
  summaryBoxMid: {
    borderLeftWidth: 1, borderRightWidth: 1, borderColor: Colors.border,
  },
  summaryVal: { fontSize: 18, fontWeight: '900', color: Colors.textMain },
  summaryLbl: { fontSize: 9, color: Colors.textSub, fontWeight: '700', marginTop: 2, textAlign: 'center' },

  // App list
  appList: {
    borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12,
  },
  appRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  appDot: { width: 6, height: 6, borderRadius: 3, marginRight: 10 },
  appName: { flex: 1, fontSize: 13, fontWeight: '700', color: Colors.textSub },
  appMins: { fontSize: 13, fontWeight: '900', color: Colors.textMain },

  // Category grid (2x2)
  catGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 14,
    borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 14,
  },
  catItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    width: '45%',
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  catItemActive: {
    backgroundColor: Colors.background,
    borderColor: Colors.border,
    ...Shadows.soft,
  },
  catDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  catLabel: { fontSize: 10, color: Colors.textSub, fontWeight: '700' },
  catValue: { fontSize: 14, fontWeight: '900', color: Colors.textMain, marginTop: 1 },
});
