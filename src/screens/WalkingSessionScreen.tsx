import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, PermissionsAndroid, Platform, NativeModules, SafeAreaView, NativeEventEmitter } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { RootStackParamList } from '../navigation/AppNavigator';
import DatabaseService from '../services/DatabaseService';
import CustomAlert from '../components/CustomAlert';

const { DetoxService } = NativeModules;
const eventEmitter = new NativeEventEmitter(DetoxService);

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'WalkingSession'>;
};

const WalkingSessionScreen: React.FC<Props> = ({ navigation }) => {
  const [isTracking, setIsTracking] = useState(false);
  const [activity, setActivity] = useState('DIAM');
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [distance, setDistance] = useState(0); 
  const [coins, setCoins] = useState(0);
  const [duration, setDuration] = useState(0); 
  
  const [alertInfo, setAlertInfo] = useState({ visible: false, title: '', message: '', type: 'info' as 'success' | 'error' | 'info', onSuccessClose: false });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Listen to Consolidated Native Update (Strava-level Accuracy)
    const statsSub = eventEmitter.addListener('onWalkingStatsUpdate', (data) => {
      setDistance(data.distance);
      setCoins(data.coins);
      setLocation({ lat: data.lat, lng: data.lng });
      
      const typeMap: Record<string, string> = {
          'WALKING': 'JALAN',
          'RUNNING': 'LARI',
          'STILL': 'DIAM',
          'IN_VEHICLE': 'BERKENDARA',
          'ON_FOOT': 'JALAN'
      };
      setActivity(typeMap[data.activity] || data.activity);
    });

    return () => {
      statsSub.remove();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startSession = async () => {
    try {
      if (Platform.OS === 'android') {
        const permissions = [
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ];

        // Android 10+ needs ACTIVITY_RECOGNITION
        if (Platform.Version >= 29) {
          permissions.push('android.permission.ACTIVITY_RECOGNITION' as any);
        }

        const granted: any = await PermissionsAndroid.requestMultiple(permissions);
        
        const isLocationGranted = granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED;
        const isActivityGranted = Platform.Version >= 29 
            ? granted['android.permission.ACTIVITY_RECOGNITION' as any] === PermissionsAndroid.RESULTS.GRANTED
            : true;

        if (!isLocationGranted || !isActivityGranted) {
          setAlertInfo({ 
            visible: true, 
            title: 'Izin Diperlukan', 
            message: 'Mode jalan butuh izin lokasi dan deteksi aktivitas fisik agar akurat.', 
            type: 'error', 
            onSuccessClose: false 
          });
          return;
        }

        // Check for Background Location (Manual check since requestMultiple often misses 'Always' on Android 11+)
        if (Platform.Version >= 29) {
          const bgGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION);
          if (!bgGranted) {
            setAlertInfo({
              visible: true,
              title: 'Layar Mati?',
              message: 'Agar tetap ngetrack saat layar mati, pilih "Izinkan Sepanjang Waktu" di setting lokasi.',
              type: 'info',
              onSuccessClose: false
            });
            // We don't block start, just warn. But if they want it robust, they need it.
          }
        }
      }

      const success = await DetoxService.startWalkingSession();
      if (success) {
        setIsTracking(true);
        setDuration(0);
        setDistance(0);
        setCoins(0);
        
        timerRef.current = setInterval(() => {
          setDuration(prev => prev + 1);
        }, 1000);
      }
      
    } catch (err: any) {
      console.error(err);
      setAlertInfo({ visible: true, title: 'Error', message: 'Gagal memulai sesi: ' + err.message, type: 'error', onSuccessClose: false });
    }
  };

  const stopSession = async () => {
    try {
      if (timerRef.current) clearInterval(timerRef.current);
      
      // Stop session and get final results from Native
      const finalStats = await DetoxService.stopWalkingSession();
      
      const finalCoins = finalStats.coins || 0;
      const finalDist = finalStats.distance || 0;

      if (finalCoins > 0 || finalDist > 0) {
        await DatabaseService.updateDailyStats(finalCoins, finalDist / 1000, 0);
        if (finalCoins > 0) {
            await DetoxService.buyTime(finalCoins);
        }
      }
      
      setIsTracking(false);
      setAlertInfo({ 
        visible: true, 
        title: 'Sesi Disimpan', 
        message: `Kamu berhasil mengumpulkan ${finalCoins} menit waktu bebas!`, 
        type: 'success', 
        onSuccessClose: true 
      });
    } catch (err) {
      console.error(err);
      setIsTracking(false);
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#134e4a', '#0f766e']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sesi Jalan Kaki</Text>
      </LinearGradient>

      <View style={styles.content}>
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>JARAK</Text>
            <Text style={styles.statValue}>{(distance / 1000).toFixed(2)}</Text>
            <Text style={styles.statUnit}>KM</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>DURASI</Text>
            <Text style={styles.statValue}>{formatTime(duration)}</Text>
            <Text style={styles.statUnit}>MNT</Text>
          </View>
        </View>

        <View style={styles.mainDisplay}>
          <View style={styles.activityBadge}>
            <Ionicons 
                name={activity === 'JALAN' || activity === 'LARI' ? "walk" : "body"} 
                size={24} color="#14b8a6" 
            />
            <Text style={styles.activityText}>{activity}</Text>
          </View>
          
          <Text style={styles.coinsValue}>{coins}</Text>
          <Text style={styles.coinsLabel}>MENIT BEBAS</Text>
          
          {location && isTracking && (
              <View style={styles.gpsContainer}>
                  <Ionicons name="location" size={14} color="#64748b" />
                  <Text style={styles.gpsText}>{location.lat.toFixed(5)}, {location.lng.toFixed(5)}</Text>
              </View>
          )}
        </View>

        <TouchableOpacity 
          style={[styles.actionButton, isTracking ? styles.stopButton : styles.startButton]}
          onPress={isTracking ? stopSession : startSession}
        >
          <Text style={styles.actionButtonText}>
            {isTracking ? "BERHENTI" : "MULAI JALAN"}
          </Text>
        </TouchableOpacity>
      </View>

      <CustomAlert
        visible={alertInfo.visible}
        title={alertInfo.title}
        message={alertInfo.message}
        type={alertInfo.type}
        onClose={() => {
          setAlertInfo(prev => ({ ...prev, visible: false }));
          if (alertInfo.onSuccessClose) {
            // Fix: Gunakan rute yang benar untuk navigasi bertingkat (Nested Navigation)
            navigation.navigate('MainTabs', { screen: 'Dashboard' });
          }
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0fdfa' },
  header: { padding: 25, paddingBottom: 60, borderBottomLeftRadius: 40, borderBottomRightRadius: 40 },
  backButton: { marginBottom: 15 },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: '900' },
  content: { flex: 1, paddingHorizontal: 25, marginTop: -40 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
  statBox: { backgroundColor: '#fff', width: '47%', padding: 20, borderRadius: 25, elevation: 4, alignItems: 'center' },
  statLabel: { color: '#64748b', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  statValue: { color: '#134e4a', fontSize: 32, fontWeight: '900', marginVertical: 4 },
  statUnit: { color: '#14b8a6', fontSize: 14, fontWeight: '700' },
  mainDisplay: { flex: 1, backgroundColor: '#fff', borderRadius: 40, padding: 30, alignItems: 'center', justifyContent: 'center', elevation: 5, marginBottom: 30 },
  activityBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0fdfa', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: '#ccfbf1', marginBottom: 40 },
  activityText: { color: '#0d9488', fontWeight: '900', marginLeft: 10, fontSize: 16 },
  coinsValue: { color: '#134e4a', fontSize: 100, fontWeight: '900' },
  coinsLabel: { color: '#14b8a6', fontSize: 16, fontWeight: '800', letterSpacing: 2 },
  gpsContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 40 },
  gpsText: { color: '#64748b', fontSize: 12, marginLeft: 6, fontWeight: '600' },
  actionButton: { paddingVertical: 22, borderRadius: 25, alignItems: 'center', elevation: 10 },
  startButton: { backgroundColor: '#14b8a6' },
  stopButton: { backgroundColor: '#ef4444' },
  actionButtonText: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 2 }
});

export default WalkingSessionScreen;
