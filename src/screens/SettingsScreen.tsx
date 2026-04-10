import React, { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  NativeModules,
  AppState,
  Linking
} from 'react-native';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { RootStackParamList, TabParamList } from '../navigation/AppNavigator';

const { DetoxService } = NativeModules;

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Settings'>,
  NativeStackScreenProps<RootStackParamList>
>;

export default function SettingsScreen({ navigation }: Props) {
  const [rules, setRules] = useState({
    baseQuotaMins: 0,
    dailyMaxMins: 60,
    secPerStep: 0.5,
    minPerPushup: 1.0,
    minPerSquat: 1.0,
    minPerJump: 1.0
  });

  const [permissions, setPermissions] = useState({
    usageStats: false,
    overlay: false,
    batteryOptimization: false,
    backgroundPopup: false
  });

  useEffect(() => {
    fetchRules();
    checkPermissions();
    const timer = setInterval(checkPermissions, 3000);
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        checkPermissions();
      }
    });

    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);

  const fetchRules = async () => {
    try {
      const r = await DetoxService.getRules();
      if (r) setRules(r);
    } catch (e) {
      console.error('Fetch rules error:', e);
    }
  };

  const checkPermissions = async () => {
    try {
      const p = await DetoxService.checkPermissions();
      setPermissions(p);
    } catch (e) {
      console.error('Check permissions error:', e);
    }
  };

  const updateRules = async (key: string, value: any) => {
    const newRules = { ...rules, [key]: value, baseQuotaMins: 0 };
    setRules(newRules);
    try {
      if (key === 'baseQuotaMins' || key === 'dailyMaxMins') {
        await DetoxService.setRules(0, newRules.dailyMaxMins);
      } else {
        await DetoxService.setRates(newRules.secPerStep, newRules.minPerPushup, newRules.minPerSquat, newRules.minPerJump);
      }
    } catch (e) {
      console.error('Update rules error:', e);
    }
  };

  const handleRequestPermission = (type: string) => {
    switch (type) {
      case 'usageStats': DetoxService.requestUsagePermission(); break;
      case 'overlay': DetoxService.requestOverlayPermission(); break;
      case 'battery': DetoxService.requestBatteryOptimizationPermission(); break;
      case 'background': DetoxService.requestBackgroundPopupPermission(); break;
    }
  };

  const PermissionRow = ({ label, granted, icon, type }: { label: string, granted: boolean, icon: string, type: string }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => handleRequestPermission(type)}
      activeOpacity={0.7}
    >
      <View style={styles.rowText}>
        <Ionicons name={icon} size={20} color={granted ? "#14B8A6" : "#64748B"} style={{ marginRight: 12 }} />
        <Text style={[styles.rowTitle, !granted && { color: '#64748B' }]}>{label}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {!granted && <Text style={{ fontSize: 12, color: '#EF4444', marginRight: 8, fontWeight: '700' }}>AKTIFKAN</Text>}
        <Ionicons
          name={granted ? "checkmark-circle" : "alert-circle"}
          size={24}
          color={granted ? "#14B8A6" : "#EF4444"}
        />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#FFFFFF', '#F8FAFC']} style={StyleSheet.absoluteFill} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Pengaturan</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Batas Penggunaan HP</Text>
          <View style={styles.card}>
            <View style={styles.configItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.configLabel}>Batas Waktu Harian</Text>
              </View>
              <View style={styles.stepper}>
                <TouchableOpacity onPress={() => updateRules('dailyMaxMins', Math.max(10, rules.dailyMaxMins - 10))} style={styles.stepBtn}>
                  <Ionicons name="remove" size={18} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.stepVal}>{rules.dailyMaxMins} mnt</Text>
                <TouchableOpacity onPress={() => updateRules('dailyMaxMins', rules.dailyMaxMins + 10)} style={styles.stepBtn}>
                  <Ionicons name="add" size={18} color="#0F172A" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Atur Hadiah Olahraga</Text>
          <View style={styles.card}>
            <View style={styles.configItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.configLabel}>Hadiah Jalan Kaki</Text>
              </View>
              <View style={styles.stepper}>
                <TouchableOpacity
                  onPress={() => updateRules('secPerStep', Math.max(0.1, Number((rules.secPerStep - 0.1).toFixed(1))))}
                  style={styles.stepBtn}
                >
                  <Ionicons name="remove" size={18} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.stepVal}>{rules.secPerStep} dtk</Text>
                <TouchableOpacity
                  onPress={() => updateRules('secPerStep', Number((rules.secPerStep + 0.1).toFixed(1)))}
                  style={styles.stepBtn}
                >
                  <Ionicons name="add" size={18} color="#0F172A" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.configItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.configLabel}>Hadiah Push-up</Text>
              </View>
              <View style={styles.stepper}>
                <TouchableOpacity
                  onPress={() => updateRules('minPerPushup', Math.max(0.5, Number((rules.minPerPushup - 0.5).toFixed(1))))}
                  style={styles.stepBtn}
                >
                  <Ionicons name="remove" size={18} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.stepVal}>{rules.minPerPushup} mnt</Text>
                <TouchableOpacity
                  onPress={() => updateRules('minPerPushup', Number((rules.minPerPushup + 0.5).toFixed(1)))}
                  style={styles.stepBtn}
                >
                  <Ionicons name="add" size={18} color="#0F172A" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.configItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.configLabel}>Hadiah Squat</Text>
              </View>
              <View style={styles.stepper}>
                <TouchableOpacity
                  onPress={() => updateRules('minPerSquat', Math.max(0.5, Number((rules.minPerSquat - 0.5).toFixed(1))))}
                  style={styles.stepBtn}
                >
                  <Ionicons name="remove" size={18} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.stepVal}>{rules.minPerSquat} mnt</Text>
                <TouchableOpacity
                  onPress={() => updateRules('minPerSquat', Number((rules.minPerSquat + 0.5).toFixed(1)))}
                  style={styles.stepBtn}
                >
                  <Ionicons name="add" size={18} color="#0F172A" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.configItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.configLabel}>Hadiah Jumping Jack</Text>
              </View>
              <View style={styles.stepper}>
                <TouchableOpacity
                  onPress={() => updateRules('minPerJump', Math.max(0.5, Number((rules.minPerJump - 0.5).toFixed(1))))}
                  style={styles.stepBtn}
                >
                  <Ionicons name="remove" size={18} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.stepVal}>{rules.minPerJump} mnt</Text>
                <TouchableOpacity
                  onPress={() => updateRules('minPerJump', Number((rules.minPerJump + 0.5).toFixed(1)))}
                  style={styles.stepBtn}
                >
                  <Ionicons name="add" size={18} color="#0F172A" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Izin Aplikasi (Wajib Aktif)</Text>
          <View style={styles.card}>
            <PermissionRow label="Izin Pantau Aplikasi" granted={permissions.usageStats} icon="stats-chart-outline" type="usageStats" />
            <PermissionRow label="Izin Muncul Panel Blokir" granted={permissions.overlay} icon="copy-outline" type="overlay" />
            <PermissionRow label="Izin Hemat Baterai (Matikan)" granted={permissions.batteryOptimization} icon="battery-charging-outline" type="battery" />
            <PermissionRow label="Izin Muncul di Layar Mati" granted={permissions.backgroundPopup} icon="layers-outline" type="background" />
          </View>
        </View>

        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bantuan & Privasi</Text>
            <View style={styles.card}>
                <TouchableOpacity style={styles.row} onPress={() => Linking.openURL('https://detoxmove.app/privacy')}>
                    <View style={styles.rowText}>
                        <Ionicons name="shield-checkmark-outline" size={20} color="#64748B" style={{ marginRight: 12 }} />
                        <Text style={styles.rowTitle}>Kebijakan Privasi</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </TouchableOpacity>

                <View style={styles.divider} />

                <TouchableOpacity style={styles.row} onPress={() => Linking.openURL('https://detoxmove.app/terms')}>
                    <View style={styles.rowText}>
                        <Ionicons name="document-text-outline" size={20} color="#64748B" style={{ marginRight: 12 }} />
                        <Text style={styles.rowTitle}>Syarat & Ketentuan</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </TouchableOpacity>

                <View style={styles.divider} />

                <TouchableOpacity style={styles.row} onPress={() => Linking.openURL('mailto:support@detoxmove.app?subject=Laporan Bug - DetoxMove')}>
                    <View style={styles.rowText}>
                        <Ionicons name="bug-outline" size={20} color="#64748B" style={{ marginRight: 12 }} />
                        <Text style={styles.rowTitle}>Laporkan Bug</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </TouchableOpacity>
            </View>
            <Text style={styles.footerBrand}>DetoxMove v1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { padding: 24, paddingBottom: 100 },
  title: { fontSize: 26, color: '#0F172A', fontWeight: '800', marginBottom: 32, marginTop: 12 },
  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', marginBottom: 12, letterSpacing: 1 },
  card: { backgroundColor: '#F8FAFC', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  rowText: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  rowTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  configItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  configLabel: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  configSub: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 4, borderWidth: 1, borderColor: '#E2E8F0' },
  stepBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: '#F1F5F9' },
  stepVal: { paddingHorizontal: 10, fontSize: 14, fontWeight: '800', color: '#0F172A', minWidth: 45, textAlign: 'center' },
  divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 8 },
  footerBrand: { textAlign: 'center', marginTop: 32, fontSize: 12, fontWeight: '600', color: '#94A3B8', letterSpacing: 1 }
});
