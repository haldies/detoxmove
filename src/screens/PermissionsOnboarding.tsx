import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, View, Text, TouchableOpacity, 
  NativeModules, Platform, Animated,
  ActivityIndicator, StatusBar
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import Theme, { Colors, Radius, Spacing, Shadows } from '../theme/theme';

const { DetoxService } = NativeModules;

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Permissions'>;
};

interface PermissionItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  key: string;
  isOptional?: boolean;
}

const PERMISSIONS_LIST_ANDROID: PermissionItem[] = [
  {
    id: 'usage',
    title: 'Akses Penggunaan',
    description: 'Monitor aplikasi aktif agar bisa dibatasi.',
    icon: 'stats-chart',
    key: 'usageStats'
  },
  {
    id: 'overlay',
    title: 'Tampilan di Atas',
    description: 'Menampilkan layar blokir saat waktu habis.',
    icon: 'layers',
    key: 'overlay'
  },
  {
    id: 'battery',
    title: 'Optimasi Baterai',
    description: 'Lancar di latar belakang.',
    icon: 'battery-charging',
    key: 'batteryOptimization',
    isOptional: true
  },
  {
    id: 'notifications',
    title: 'Notifikasi',
    description: 'Terima peringatan sesi detox.',
    icon: 'notifications-outline',
    key: 'notifications',
    isOptional: true
  },
  {
    id: 'background',
    title: 'Popup (MIUI)',
    description: 'Layar blokir muncul seketika.',
    icon: 'duplicate-outline',
    key: 'backgroundPopup',
    isOptional: true
  }
];

const PERMISSIONS_LIST_IOS: PermissionItem[] = [
  {
    id: 'usage',
    title: 'Screen Time',
    description: 'Izinkan pembatasan aplikasi otomatis.',
    icon: 'hourglass-outline',
    key: 'usageStats'
  },
  {
    id: 'motion',
    title: 'Gerak & Fitur',
    description: 'Deteksi aktivitas jalan dan olahraga.',
    icon: 'walk-outline',
    key: 'activityRecognition'
  },
  {
    id: 'notifications',
    title: 'Notifikasi',
    description: 'Peringatan sisa waktu sesi.',
    icon: 'notifications-outline',
    key: 'notifications',
    isOptional: true
  }
];

const PERMISSIONS_LIST = Platform.OS === 'android' ? PERMISSIONS_LIST_ANDROID : PERMISSIONS_LIST_IOS;

export default function PermissionsOnboarding({ navigation }: Props) {
  const [granted, setGranted] = useState<Record<string, boolean>>({});
  const [isXiaomi, setIsXiaomi] = useState(false); // To detect Xiaomi/MIUI 📱
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const checkStatus = async () => {
    try {
      const status = await DetoxService.checkPermissions();
      setGranted(status);
      
      // Get device manufacturer safely to avoid TS errors 🕵️‍♂️
      const constants = Platform.constants as any;
      const brand = (constants.Brand || constants.Manufacturer || "").toLowerCase();
      
      if (brand.includes('xiaomi') || brand.includes('redmi') || brand.includes('poco')) {
        setIsXiaomi(true);
      }
    } catch (e) {}
  };

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    checkStatus();
    const timer = setInterval(checkStatus, 2000);
    return () => clearInterval(timer);
  }, []);

  const handleGrant = (id: string) => {
    if (Platform.OS === 'android') {
      switch(id) {
        case 'usage': DetoxService.requestUsagePermission(); break;
        case 'overlay': DetoxService.requestOverlayPermission(); break;
        case 'battery': DetoxService.requestBatteryOptimizationPermission(); break;
        case 'notifications': DetoxService.requestNotificationPermission(); break;
        case 'background': DetoxService.requestBackgroundPopupPermission(); break;
      }
    } else {
      switch(id) {
        case 'usage': DetoxService.requestUsagePermission(); break;
        // iOS screen time combines usage and blocking
        case 'motion': 
          // Native logic for CoreMotion request if needed, 
          // or just guidance/checking
          break;
        case 'notifications': 
          // Handle via standard RN permissions or native bridge
          break;
      }
    }
  };

  const isMandatoryDone = Platform.OS === 'android' 
    ? (granted.usageStats && granted.overlay)
    : (granted.usageStats && granted.activityRecognition);

  const PermissionRow = ({ item }: { item: PermissionItem }) => {
    const isGranted = granted[item.key];
    return (
      <TouchableOpacity 
        style={styles.row} 
        onPress={() => !isGranted && handleGrant(item.id)}
        activeOpacity={0.6}
      >
        <View style={[styles.iconBox, isGranted && styles.iconBoxGranted]}>
          <Ionicons name={item.icon as any} size={20} color={isGranted ? "#FFFFFF" : Colors.primary} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.cardTitle}>{item.title}{item.isOptional && <Text style={styles.optTag}> (Opsional)</Text>}</Text>
          <Text style={styles.cardDesc}>{item.description}</Text>
        </View>
        <View style={styles.actionIcon}>
            {isGranted ? (
                <View style={styles.checkCircle}>
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                </View>
            ) : (
                <View style={styles.grantBtnSmall}>
                    <Text style={styles.grantBtnText}>AKTIFKAN</Text>
                </View>
            )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <LinearGradient colors={[Colors.background, '#FFFFFF']} style={StyleSheet.absoluteFill} />
      
      <Animated.View style={[styles.mainWrap, { opacity: fadeAnim }]}>
        <View style={styles.header}>
            <Text style={styles.miniBadge}>Izin Sistem</Text>
            <Text style={styles.welcome}>Selesaikan Setup.</Text>
            <Text style={styles.subtitle}>Aktifkan kendali aplikasi untuk memulai sesi detox Anda.</Text>
        </View>

        <View style={styles.list}>
            {PERMISSIONS_LIST.map(item => {
                // HIDE Background Popup IF NOT Xiaomi 🕵️‍♂️🚫🌑
                if (item.id === 'background' && !isXiaomi) return null;

                return (
                    <React.Fragment key={item.id}>
                        <PermissionRow item={item} />
                        <View style={styles.divider} />
                    </React.Fragment>
                );
            })}
        </View>
      </Animated.View>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.startBtn, !isMandatoryDone && styles.startBtnDisabled]} 
          onPress={() => isMandatoryDone && navigation.replace('MainTabs')}
          disabled={!isMandatoryDone}
          activeOpacity={0.8}
        >
          <LinearGradient 
             colors={isMandatoryDone ? [Colors.primary, Colors.primaryDark] : [Colors.textPlaceholder, Colors.textSub]} 
             style={styles.btnGradient}
          >
            <Text style={styles.startBtnText}>
                {isMandatoryDone ? 'MEMULAI' : 'IZIN WAJIB BELUM AKTIF'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
        {!isMandatoryDone && (
            <Text style={styles.footerHint}>
                {Platform.OS === 'android' ? 'Aktifkan Akses Penggunaan & Overlay.' : 'Aktifkan Screen Time & Gerak.'}
            </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  mainWrap: { flex: 1, paddingHorizontal: 32, paddingTop: 50 },
  header: { marginBottom: 32 },
  miniBadge: { color: Colors.primary, fontWeight: '900', fontSize: 11, letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' },
  welcome: { fontSize: 32, fontWeight: '900', color: Colors.textMain, marginBottom: 10 },
  subtitle: { fontSize: 15, color: Colors.textSub, lineHeight: 22, fontWeight: '500' },
  list: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 10 },
  row: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 16, 
  },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginLeft: 64 },
  iconBox: { 
    width: 44, 
    height: 44, 
    borderRadius: Radius.md, 
    backgroundColor: Colors.primaryLight, 
    justifyContent: 'center', 
    alignItems: 'center',
    marginRight: 16
  },
  iconBoxGranted: { backgroundColor: Colors.primary },
  textContainer: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: Colors.textMain, marginBottom: 2 },
  optTag: { fontSize: 11, fontWeight: '700', color: Colors.textPlaceholder },
  cardDesc: { fontSize: 12, color: Colors.textSub, lineHeight: 16 },
  actionIcon: { marginLeft: 10 },
  checkCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  grantBtnSmall: { backgroundColor: Colors.secondary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.sm },
  grantBtnText: { color: "#FFFFFF", fontSize: 9, fontWeight: '900' },

  footer: { padding: 32, paddingBottom: Platform.OS === 'android' ? 40 : 50 },
  startBtn: { height: 62, borderRadius: 31, overflow: 'hidden', ...Shadows.strong },
  startBtnDisabled: { opacity: 0.6 },
  btnGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  startBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  footerHint: { textAlign: 'center', marginTop: 15, fontSize: 11, color: Colors.danger, fontWeight: '700' }
});
