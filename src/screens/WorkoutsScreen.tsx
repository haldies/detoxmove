import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, SafeAreaView, Dimensions, NativeModules } from 'react-native';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, TabParamList } from '../navigation/AppNavigator';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import DatabaseService from '../services/DatabaseService';
import Theme, { Colors, Radius, Spacing, Shadows } from '../theme/theme'; // Import Theme ✨

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'WorkoutList'>,
  NativeStackScreenProps<RootStackParamList>
>;

const { DetoxService } = NativeModules;

export default function WorkoutsScreen({ navigation }: Props) {
  const [rules, setRules] = React.useState({ secPerStep: 0.5, minPerPushup: 1.0, minPerSquat: 1.0, minPerJump: 1.0 });

  React.useEffect(() => {
    // --- AUTO HYBRID AI (Full/Lite otomatis via RAM check) --- ✨
    DetoxService.prepareAI();

    const fetchRules = async () => {
      try {
        const r = await DetoxService.getRules();
        if (r) setRules(r);
      } catch (e) {}
    };
    fetchRules();
  }, []);

  const WORKOUTS = [
    {
      id: 'walking',
      title: 'Jalan Kaki',
      icon: 'walk',
      color: Colors.primary,
      screen: 'WalkingSession',
      params: {},
      reward: `+${rules.secPerStep} Dtk / 50m`
    },
    {
      id: 'pushup',
      title: 'Push-up',
      icon: 'body',
      color: Colors.primaryDark,
      screen: 'CameraTest',
      params: { mode: 'PUSHUP' },
      reward: `+${rules.minPerPushup} Mnt / Push-up`
    },
    {
      id: 'squat',
      title: 'Squat',
      icon: 'fitness',
      color: Colors.accent,
      screen: 'CameraTest',
      params: { mode: 'SQUAT' },
      reward: `+${rules.minPerSquat} Mnt / Squat`
    },
    {
      id: 'jumpingjack',
      title: 'Jumping Jacks',
      icon: 'body-outline',
      color: Colors.primaryDark,
      screen: 'CameraTest',
      params: { mode: 'JUMPINGJACK' },
      reward: `+${rules.minPerJump} Mnt / Reps`
    }
  ];

  const handleNavigate = (item: any) => {
    if (item.screen) {
        navigation.navigate(item.screen as any, item.params);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={[Colors.background, Colors.border]} style={StyleSheet.absoluteFill} />
      
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
            <Text style={styles.title}>Olahraga</Text>
        </View>

        {WORKOUTS.map((item) => (
            <TouchableOpacity 
                key={item.id}
                style={[styles.card, !item.screen && styles.disabledCard]}
                onPress={() => handleNavigate(item)}
                activeOpacity={0.7}
                disabled={!item.screen}
            >
                <View style={[styles.iconBox, { backgroundColor: item.color + '20' }]}>
                    <Ionicons name={item.icon} size={28} color={item.color} />
                </View>
                <View style={styles.cardContent}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <View style={styles.rewardBadge}>
                       <Text style={[styles.rewardTxt, { color: item.color }]}>{item.reward}</Text>
                    </View>
                </View>
                {item.screen && <Ionicons name="chevron-forward" size={24} color={Colors.textPlaceholder} />}
            </TouchableOpacity>
        ))}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingTop: Spacing.lg },
  header: { marginBottom: 24, marginTop: 8 },
  title: { fontSize: 26, fontWeight: '900', color: Colors.textMain, marginBottom: 4 },
  subtitle: { fontSize: 13, color: Colors.textSub, fontWeight: '600' },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 14, marginBottom: 14, flexDirection: 'row', alignItems: 'center', ...Shadows.soft, borderWidth: 1, borderColor: Colors.border },
  disabledCard: { opacity: 0.6 },
  iconBox: { width: 48, height: 48, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center' },
  cardContent: { flex: 1, marginLeft: 14 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: Colors.textMain, marginBottom: 4 },
  rewardBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primaryLight, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.sm },
  rewardTxt: { fontWeight: '900', fontSize: 11 },
  proTip: { marginTop: 16, backgroundColor: Colors.primaryLight, padding: 16, borderRadius: Radius.lg, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  proTipTxt: { flex: 1, marginLeft: 10, fontSize: 12, color: Colors.primaryDark, fontWeight: '600', lineHeight: 18 }
});
