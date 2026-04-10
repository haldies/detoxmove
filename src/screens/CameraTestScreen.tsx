import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, SafeAreaView,
  Platform, PermissionsAndroid, DeviceEventEmitter, NativeModules, InteractionManager, ActivityIndicator
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { RootStackParamList } from '../navigation/AppNavigator';
import NativeCameraView from '../components/NativeCameraView';
import DatabaseService from '../services/DatabaseService';
import Theme, { Colors, Radius, Spacing, Shadows } from '../theme/theme'; 

const { DetoxService } = NativeModules;

type Props = NativeStackScreenProps<RootStackParamList, 'CameraTest'>;

export default function CameraTestScreen({ navigation, route }: Props) {
  const { mode } = route.params || { mode: 'PUSHUP' };
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false); 
  const [isPoseCorrect, setIsPoseCorrect] = useState(true);
  const [rewardValue, setRewardValue] = useState(1.0);

  const [debugData, setDebugData] = useState({ angle: 0, verticalDiff: 0, state: 'UP', count: 0 });
  const cameraRef = useRef<any>(null);
  const countRef = useRef(0);

  const thresholdDown = mode === 'SQUAT' ? 110 : 80;
  const thresholdUp = mode === 'SQUAT' ? 165 : 155;
  const maxVerticalDiff = mode === 'SQUAT' ? 0.40 : 0.25;

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      checkPermission();
      fetchRules();
      setIsReady(true)
      DetoxService.prepareAI();
    });

    const sub = DeviceEventEmitter.addListener('onDebugUpdate', (e) => {
      setDebugData({
        angle: Math.round(e.angle * 10) / 10,
        verticalDiff: Math.round(e.verticalDiff * 1000) / 1000,
        state: e.state,
        count: e.count || 0,
      });
    });

    const countSub = DeviceEventEmitter.addListener('onCountUpdate', (e) => {
      if (e.count > countRef.current) {
        countRef.current = e.count;

        // --- UPDATE UI STATE AGAR ANGKA BERUBAH --- ✨
        setDebugData(prev => ({ ...prev, count: e.count }));

        DetoxService.buyTime(rewardValue)
          .catch((err: any) => console.error("[JS] Failed to award time:", err));
        DatabaseService.addRep(mode, rewardValue);
      }
    });

    const modelSub = DeviceEventEmitter.addListener('onModelReady', () => {
      console.log("[JS] AI Model is loaded on GPU. Switching UI...");
      setIsModelReady(true);
    });

    const statusSub = DeviceEventEmitter.addListener('onPoseStatus', (e) => {
      setIsPoseCorrect(e.isPoseCorrect);
    });

    return () => {
      task.cancel();
      sub.remove();
      countSub.remove();
      modelSub.remove();
      statusSub.remove();
    };
  }, [mode, rewardValue]);

  const checkPermission = async () => {
    if (Platform.OS === 'android') {
      const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
      setHasPermission(res === PermissionsAndroid.RESULTS.GRANTED);
    }
  };

  const fetchRules = async () => {
    try {
      const r = await DetoxService.getRules();
      if (r) {
        if (mode === 'SQUAT') setRewardValue(r.minPerSquat || 1.0);
        else if (mode === 'JUMPINGJACK') setRewardValue(r.minPerJump || 1.0);
        else setRewardValue(r.minPerPushup || 1.0);
      }
    } catch (e) { }
  };

  if (!isReady || hasPermission === null) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.secondary }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {hasPermission ? (
        <NativeCameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          thresholdDown={thresholdDown}
          thresholdUp={thresholdUp}
          maxVerticalDiff={maxVerticalDiff}
          workoutMode={mode}
        />
      ) : (
        <View style={styles.noPermBox}>
          <Ionicons name="camera-off-outline" size={40} color="#94a3b8" />
          <Text style={styles.noPermText}>Izin kamera diperlukan</Text>
        </View>
      )}

      <SafeAreaView style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="close" size={32} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>

        <View style={styles.centerBox}>
          {!isPoseCorrect && (
            <View style={styles.warningBanner}>
              <Ionicons name="warning" size={20} color="#fff" />
              <Text style={styles.warningText}>FULL BODY NOT DETECTED</Text>
            </View>
          )}
          <Text style={styles.repNum}>{debugData.count}</Text>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.stopBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Text style={styles.stopBtnText}>SELESAI</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.secondary },
  noPermBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  noPermText: { color: Colors.textPlaceholder, fontSize: 14 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    paddingTop: Platform.OS === 'android' ? 24 : 0
  },
  backBtn: { padding: 4 },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  repNum: {
    color: Colors.surface,
    fontSize: 120,
    fontWeight: '900',
    lineHeight: 160,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 20
  },
  repLabel: { color: Colors.surface, fontSize: 16, fontWeight: '800', letterSpacing: 8, opacity: 0.6, marginTop: -10 },
  footer: { padding: Spacing.xl, alignItems: 'center' },
  stopBtn: {
    backgroundColor: Colors.surface,
    width: '100%',
    paddingVertical: 18,
    borderRadius: Radius.lg,
    alignItems: 'center',
    marginBottom: 20,
    ...Shadows.strong,
  },
  stopBtnText: { color: Colors.secondary, fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  warningBanner: {
    position: 'absolute',
    top: 50,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: Radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    zIndex: 100,
  },
  warningText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  }
});
