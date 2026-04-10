import React, { useState, useEffect, useCallback } from 'react';
import { 
  StyleSheet, View, Text, ScrollView, TouchableOpacity, 
  SafeAreaView, Dimensions, NativeModules,
  Image
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import DatabaseService, { UserStats } from '../services/DatabaseService';
import Theme, { Colors, Radius, Spacing, Shadows } from '../theme/theme'; // Import Theme ✨

const { DetoxService, UsageModule } = NativeModules;
const { width } = Dimensions.get('window');
const ITEM_WIDTH = (width - 48 - 30) / 3; 

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'MainTabs'>;
};

interface AppUsageInfo {
    packageName: string;
    appName: string;
    timeMs: number;
}

const AppIcon = ({ packageName }: { packageName: string }) => {
    const [icon, setIcon] = useState<string | null>(null);
    useEffect(() => {
        DetoxService.getAppIcon(packageName).then(setIcon).catch(() => {});
    }, [packageName]);

    if (!icon) return (
        <View style={styles.iconPlaceholder}>
            <Ionicons name="apps" size={20} color="#94A3B8" />
        </View>
    );
    return <Image source={{ uri: `data:image/png;base64,${icon}` }} style={styles.appIcon as any} />;
};

export default function DashboardScreen({ navigation }: Props) {
  const [appUsage, setAppUsage] = useState<AppUsageInfo[]>([]);
  const [balanceMs, setBalanceMs] = useState(0);
  const [stats, setStats] = useState<UserStats | null>(null);
  
  const remainingMins = Math.max(0, Math.floor(balanceMs / 60000));

  const fetchData = async () => {
      try {
          const bal = await DetoxService.getBalance();
          setBalanceMs(bal || 0);

          const today = await DatabaseService.getTodayStats();
          setStats(today);
          
          const restricted = await DetoxService.getRestrictedApps();
          if (restricted && restricted.length > 0) {
              // Hanya jalankan jika belum aktif (hindari log spam)
              const isActive = await DetoxService.isMonitoringActive();
              if (!isActive) {
                  await DetoxService.startForegroundService().catch(() => {});
              }
              
              // Only sync heavy app list if needed (e.g. every 15s or first time)
              const now = Date.now();
              const startOfDay = new Date();
              startOfDay.setHours(0, 0, 0, 0);
              
              // We always fetch the usage stats for the list, 
              // but we can trust the purchasedMs and rules for the main big counter.
              const allUsage = await UsageModule.getUsageStats(startOfDay.getTime(), now);
              
              const filtered = allUsage
                  .filter((a: any) => restricted.includes(a.packageName))
                  .map((a: any) => ({
                      packageName: a.packageName,
                      appName: a.appName,
                      timeMs: a.totalTimeInForeground
                  }))
                  .sort((a: any, b: any) => b.timeMs - a.timeMs);
              setAppUsage(filtered);
          } else {
              setAppUsage([]);
          }
      } catch (e) { console.error(e); }
  };

  useFocusEffect(
    useCallback(() => { 
        fetchData(); 
        // Refresh UI setiap 2 detik untuk sisa waktu, tapi jangan terlalu berat
        const interval = setInterval(fetchData, 2000);
        return () => clearInterval(interval);
    }, [navigation])
  );

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#F0FDFA', '#FFFFFF']} style={StyleSheet.absoluteFill} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
            <Text style={styles.appTitle}>DetoxMove</Text>
            <TouchableOpacity style={styles.settingBtn} onPress={() => navigation.navigate('Settings' as any)}>
               <Ionicons name="settings-outline" size={20} color="#134E4A" />
            </TouchableOpacity>
        </View>

        <View style={styles.coinHero}>
            <Text style={styles.coinLabel}>SISA WAKTU BEBAS HARI INI</Text>
            <View style={styles.coinValueContainer}>
                <Text style={styles.coinValue}>{remainingMins}</Text>
                <Text style={styles.minsUnit}> MNT</Text>
            </View>
        </View>

        {/* --- STATS SECTION --- */}
        <View style={styles.statsStrip}>
            <View style={styles.statBox}>
                <Ionicons name="footsteps" size={18} color="#14B8A6" />
                <Text style={styles.statVal}>{Math.floor((stats?.distance || 0) * 1312)}</Text>
                <Text style={styles.statLab}>Langkah</Text>
            </View>
            <View style={styles.vDivider} />
            <View style={styles.statBox}>
                <Ionicons name="body" size={18} color="#14B8A6" />
                <Text style={styles.statVal}>{stats?.pushups || 0}</Text>
                <Text style={styles.statLab}>Push Up</Text>
            </View>
            <View style={styles.vDivider} />
            <View style={styles.statBox}>
                <Ionicons name="fitness" size={18} color="#14B8A6" />
                <Text style={styles.statVal}>{stats?.squats || 0}</Text>
                <Text style={styles.statLab}>Squat</Text>
            </View>
            <View style={styles.vDivider} />
            <View style={styles.statBox}>
                <Ionicons name="body-outline" size={18} color="#14B8A6" />
                <Text style={styles.statVal}>{stats?.jumps || 0}</Text>
                <Text style={styles.statLab}>Jump</Text>
            </View>
        </View>

        <LinearGradient colors={['#14B8A6', '#0D9488']} style={[styles.earnCard, { marginTop: 12 }]}>
            <View style={styles.earnInfo}>
                <Text style={styles.earnTitle}>Tambah Waktu Bebas</Text>
                <Text style={styles.earnSubtitle}>Lakukan olahraga untuk dapat jatah waktu!</Text>
            </View>
            <TouchableOpacity style={styles.earnBtn} onPress={() => navigation.navigate('WorkoutList' as any)}>
                <Text style={styles.earnBtnTxt}>MULAI</Text>
            </TouchableOpacity>
        </LinearGradient>

        <View style={styles.headerRow}>
            <Text style={styles.sectionTitle}>Aplikasi Terbatas</Text>
            <TouchableOpacity onPress={() => navigation.navigate('AppLimiter')}>
               <Text style={styles.seeAllTxt}>Kelola</Text>
            </TouchableOpacity>
        </View>

        <View style={styles.appGrid}>
            {appUsage.length === 0 ? null : (
                appUsage.map((app) => (
                    <View key={app.packageName} style={styles.gridItem}>
                        <AppIcon packageName={app.packageName} />
                        <Text style={styles.gridName} numberOfLines={1}>{app.appName}</Text>
                        <Text style={[styles.gridRemaining, { color: remainingMins > 0 ? '#14B8A6' : '#EF4444' }]}>
                            {remainingMins}m Sisa
                        </Text>
                    </View>
                ))
            )}

            <TouchableOpacity style={styles.addAppCard} onPress={() => navigation.navigate('AppLimiter')}>
                <Ionicons name="add" size={24} color="#0D9488" />
            </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: Spacing.lg },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  appTitle: { fontSize: 22, fontWeight: '900', color: Colors.primaryDark },
  settingBtn: { backgroundColor: Colors.primaryLight, padding: 10, borderRadius: Radius.md },
  coinHero: { alignItems: 'center', marginBottom: 32 },
  coinLabel: { fontSize: 13, fontWeight: '800', color: Colors.textSub, letterSpacing: 1, marginBottom: 4 },
  coinValueContainer: { flexDirection: 'row', alignItems: 'baseline' },
  coinValue: { fontSize: 80, fontWeight: '900', color: Colors.textMain },
  minsUnit: { fontSize: 20, fontWeight: '800', color: Colors.textSub, marginLeft: 4 },
  earnCard: { borderRadius: Radius.xl, padding: 20, flexDirection: 'row', alignItems: 'center', marginBottom: 32 },
  earnInfo: { flex: 1 },
  earnTitle: { color: Colors.surface, fontSize: 17, fontWeight: '900', marginBottom: 4 },
  earnSubtitle: { color: '#CCFBF1', fontSize: 12, fontWeight: '500' },
  earnBtn: { backgroundColor: Colors.surface, paddingHorizontal: 20, paddingVertical: 10, borderRadius: Radius.md },
  earnBtnTxt: { color: Colors.primaryDark, fontWeight: '900', fontSize: 14 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: Colors.textMain },
  seeAllTxt: { color: Colors.primary, fontWeight: '800', fontSize: 13 },
  appGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridItem: { width: ITEM_WIDTH, backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 12, alignItems: 'center', ...Shadows.soft, borderWidth: 1, borderColor: Colors.border },
  appIcon: { width: 44, height: 44, borderRadius: 10, marginBottom: 8 },
  iconPlaceholder: { width: 44, height: 44, borderRadius: 10, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  gridName: { fontSize: 11, fontWeight: '700', color: Colors.secondaryLight, textAlign: 'center', marginBottom: 6 },
  gridRemaining: { fontSize: 10, fontWeight: '800' },
  emptyContainer: { flex: 1, alignItems: 'center', paddingVertical: 20 },
  emptyTxt: { color: Colors.textPlaceholder, fontSize: 13, fontWeight: '500' },
  addAppCard: { width: ITEM_WIDTH, backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 12, alignItems: 'center', justifyContent: 'center', elevation: 0, borderWidth: 1.5, borderColor: '#CCFBF1', borderStyle: 'dashed', height: 100 },
  statsStrip: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 16, marginBottom: 24, ...Shadows.soft, alignItems: 'center' },
  statBox: { flex: 1, alignItems: 'center' },
  vDivider: { width: 1, height: 30, backgroundColor: Colors.border },
  statVal: { fontSize: 18, fontWeight: '900', color: Colors.textMain, marginTop: 4 },
  statLab: { fontSize: 11, fontWeight: '600', color: Colors.textSub }
});
