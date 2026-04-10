import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions, Animated, NativeModules, PanResponder, StatusBar, ActivityIndicator } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import Theme, { Colors, Radius, Spacing, Shadows } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

const { width, height } = Dimensions.get('window');
const SLIDER_WIDTH = width - 100;

export default function OnboardingScreen({ navigation }: Props) {
  const [step, setStep] = useState(0);
  const [hours, setHours] = useState(4);
  const [displayDays, setDisplayDays] = useState(0);
  const [displayYears, setDisplayYears] = useState(0);

  const sliderPos = useRef(new Animated.Value(((4 - 1) / 23) * SLIDER_WIDTH)).current;

  const { DetoxService } = NativeModules;
  const targetDays = Math.round((hours * 365) / 24);
  const targetYears = parseFloat(((hours * 365 * 50) / (24 * 365)).toFixed(1));

  // LOGIKA ANIMASI HITUNG ANGKA GANDA (TETAP ADA KARENA KEREN) 🎰🎰
  useEffect(() => {
    if (step === 3) {
      setDisplayDays(0);
      setDisplayYears(0);

      let startD = 0;
      let startY = 0;
      const duration = 1200;
      const incD = targetDays / (duration / 16);
      const incY = targetYears / (duration / 16);

      const timer = setInterval(() => {
        startD += incD;
        startY += incY;

        let doneD = false;
        let doneY = false;

        if (startD >= targetDays) {
          setDisplayDays(targetDays);
          doneD = true;
        } else {
          setDisplayDays(Math.floor(startD));
        }

        if (startY >= targetYears) {
          setDisplayYears(targetYears);
          doneY = true;
        } else {
          setDisplayYears(parseFloat(startY.toFixed(1)));
        }

        if (doneD && doneY) clearInterval(timer);
      }, 16);
      return () => clearInterval(timer);
    }
  }, [step, targetDays, targetYears]);

  useEffect(() => {
  }, [step]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        let newX = gestureState.moveX - 50;
        if (newX < 0) newX = 0;
        if (newX > SLIDER_WIDTH) newX = SLIDER_WIDTH;

        sliderPos.setValue(newX);
        const newHours = Math.round(1 + (newX / SLIDER_WIDTH) * 23);
        setHours(newHours);
      },
    })
  ).current;

  const handleFinish = async () => {
    try {
      await DetoxService.setInitialUsage(hours);
      await DetoxService.setFinishedOnboarding();
      navigation.replace('Permissions');
    } catch (e) {
      navigation.replace('Permissions');
    }
  };

  const renderContent = () => {
    switch (step) {
      case 0:
        return (
          <View style={styles.centerContent}>
            <Text style={styles.introTitle}>Waktu adalah aset{"\n"}paling berharga.</Text>
            <Text style={styles.introSubtitle}>Seringkali kita memberikannya secara cuma-cuma tanpa disadari.</Text>

            <View style={styles.fixedBottomButton}>
              <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(1)} activeOpacity={0.8}>
                <LinearGradient colors={[Colors.primary, Colors.primaryDark]} style={styles.btnGradient}>
                  <Text style={styles.btnText}>LANJUT</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 1:
        return (
          <View style={styles.centerContent}>
            <Text style={styles.question}>Berapa jam Anda scrolling{"\n"}Media Sosial setiap hari?</Text>

            <View style={styles.sliderWrapper}>
              <Text style={styles.bigNumber}>{hours}</Text>
              <Text style={styles.unitTag}>JAM / HARI</Text>

              <View style={styles.sliderTrackBox}>
                <View style={styles.baseLine} />
                <Animated.View style={[styles.activeLine, { width: sliderPos }]} />

                <Animated.View
                  {...panResponder.panHandlers}
                  style={[styles.thumb, { transform: [{ translateX: sliderPos }] }]}
                />
              </View>
              <View style={styles.labelRow}>
                <Text style={styles.dimLabel}>1 Jam</Text>
                <Text style={styles.dimLabel}>24 Jam</Text>
              </View>
            </View>

            <View style={styles.fixedBottomButton}>
              <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(3)} activeOpacity={0.8}>
                <LinearGradient colors={[Colors.primary, Colors.primaryDark]} style={styles.btnGradient}>
                  <Text style={styles.btnText}>LANJUT</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 2:
        return null;

      case 3:
        return (
          <View style={styles.centerContent}>
            <View style={styles.flatResultContainer}>
              <Text style={styles.resultLabel}>Anda akan kehilangan:</Text>
              <View style={styles.numberRow}>
                <Text style={styles.resultMain}>{displayDays}</Text>
                <Text style={styles.resultUnit}>HARI</Text>
              </View>
              <Text style={styles.flatDangerTxt}>SETIAP TAHUNNYA</Text>
            </View>

            <View style={styles.flatImpactBox}>
              <Text style={styles.impactText}>
                Artinya, dalam 50 tahun ke depan Anda akan menghabiskan <Text style={styles.boldTeal}>{displayYears} TAHUN</Text> hidup hanya untuk menatap layar.
              </Text>
            </View>

            <View style={styles.fixedBottomButton}>
              <TouchableOpacity style={styles.finishBtn} onPress={handleFinish} activeOpacity={0.8}>
                <LinearGradient colors={[Colors.primary, Colors.primaryDark]} style={styles.btnGradient}>
                  <Text style={styles.btnText}>SAYA INGIN BERUBAH</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <LinearGradient colors={[Colors.background, '#FFFFFF']} style={StyleSheet.absoluteFill} />

      {/* Background Decoration */}
      <View style={styles.circleDecor} />

      <View style={styles.safeContent}>
        {renderContent()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  safeContent: { flex: 1, paddingHorizontal: 32 },
  centerContent: { flex: 1, justifyContent: 'center' },

  // STEP 0 Styles
  introTitle: { fontSize: 36, fontWeight: '900', color: Colors.secondary, lineHeight: 46, letterSpacing: -1, marginBottom: 20, textAlign: 'center' },
  introSubtitle: { fontSize: 17, color: Colors.textSub, lineHeight: 28, fontWeight: '500', textAlign: 'center', paddingHorizontal: 10 },
  fixedBottomButton: { position: 'absolute', bottom: 40, width: width - 64, alignSelf: 'center' },

  // STEP 1 Styles
  question: { fontSize: 26, fontWeight: '900', color: Colors.textMain, lineHeight: 36, textAlign: 'center', marginBottom: 50 },
  sliderWrapper: { paddingVertical: 40, alignItems: 'center' },
  bigNumber: { fontSize: 90, fontWeight: '900', color: Colors.textMain, letterSpacing: -4 },
  unitTag: { fontSize: 14, fontWeight: '800', color: Colors.textPlaceholder, letterSpacing: 2, marginTop: -10, marginBottom: 40 },
  sliderTrackBox: { width: SLIDER_WIDTH, height: 40, justifyContent: 'center' },
  baseLine: { width: '100%', height: 4, backgroundColor: Colors.border, borderRadius: 2 },
  activeLine: { height: 4, backgroundColor: Colors.primary, borderRadius: 2, position: 'absolute' },
  tickRow: { position: 'absolute', width: '100%', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 0 },
  tick: { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.border },
  thumb: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface, position: 'absolute', left: -18, ...Shadows.strong, borderWidth: 1, borderColor: Colors.border },
  labelRow: { flexDirection: 'row', width: SLIDER_WIDTH, justifyContent: 'space-between', marginTop: 15 },
  dimLabel: { color: Colors.textPlaceholder, fontWeight: '700', fontSize: 10 },
  activeLabel: { color: Colors.primary, fontWeight: '900', fontSize: 12 },

  // STEP 2 Loading
  loaderRing: { marginBottom: 30 },
  analyzingTxt: { fontSize: 14, fontWeight: '900', color: Colors.textMain, letterSpacing: 4, marginBottom: 12 },

  // STEP 3 Result Flat Refined
  resultHeader: { alignItems: 'center', marginBottom: 50 },
  resultIntro: { fontSize: 13, fontWeight: '900', color: Colors.primary, letterSpacing: 3, marginTop: 10 },
  flatResultContainer: { alignItems: 'center', paddingVertical: 20 },
  resultLabel: { fontSize: 16, fontWeight: '700', color: Colors.textSub, marginBottom: 15 },
  numberRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: 10 },
  resultMain: { fontSize: 86, fontWeight: '900', color: Colors.secondary, letterSpacing: -3 },
  resultUnit: { fontSize: 22, fontWeight: '900', color: Colors.secondary, marginBottom: 16 },
  flatDangerTxt: { fontSize: 13, fontWeight: '900', color: Colors.danger, letterSpacing: 1.5, marginTop: 15 },

  flatImpactBox: { marginTop: 60, paddingHorizontal: 15, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 40 },
  impactText: { fontSize: 17, color: Colors.textSub, lineHeight: 28, textAlign: 'center', fontWeight: '500' },
  boldTeal: { color: Colors.primaryDark, fontWeight: '900' },

  // COMMON Buttons
  buttonContainer: { marginTop: 50, width: '100%' },
  nextBtn: { height: 60, borderRadius: 12, overflow: 'hidden', ...Shadows.strong },
  finishBtn: { height: 60, borderRadius: 12, overflow: 'hidden', ...Shadows.strong },
  btnGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  btnText: { color: Colors.surface, fontWeight: '900', letterSpacing: 2, fontSize: 14 },

  // DECORATION
  circleDecor: { position: 'absolute', top: -100, right: -100, width: 300, height: 300, borderRadius: 150, backgroundColor: Colors.primaryLight, opacity: 0.5 },
  indicatorRow: { position: 'absolute', bottom: 60, left: 32, flexDirection: 'row', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  dotActive: { width: 24, backgroundColor: Colors.primary },
});
