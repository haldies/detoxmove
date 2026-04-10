import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NativeModules, View, ActivityIndicator, AppState } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import PermissionsOnboarding from '../screens/PermissionsOnboarding';
import OnboardingScreen from '../screens/OnboardingScreen'; // Tambahkan ini ✨
import DashboardScreen from '../screens/DashboardScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AppLimiterScreen from '../screens/AppLimiterScreen';
import WalkingSessionScreen from '../screens/WalkingSessionScreen';
import WorkoutsScreen from '../screens/WorkoutsScreen';
import ReportScreen from '../screens/ReportScreen';
import CameraTestScreen from '../screens/CameraTestScreen';

const { DetoxService } = NativeModules;

export type RootStackParamList = {
  Onboarding: undefined; // Pintu Gerbang Utama ✨
  Permissions: undefined;
  MainTabs: { screen?: string } | undefined;
  AppLimiter: undefined;
  CameraTest: { mode: 'PUSHUP' | 'SQUAT' | 'JUMPINGJACK' };
  WalkingSession: undefined;
};

export type TabParamList = {
  Dashboard: undefined;
  WorkoutList: undefined;
  Report: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName = '';
          if (route.name === 'Dashboard') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'WorkoutList') iconName = focused ? 'fitness' : 'fitness-outline';
          else if (route.name === 'Report') iconName = focused ? 'stats-chart' : 'stats-chart-outline';
          else if (route.name === 'Settings') iconName = focused ? 'settings' : 'settings-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#14B8A6',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#F1F5F9',
          paddingBottom: 8,
          paddingTop: 8,
          height: 64,
          elevation: 10,
        },
        tabBarLabelStyle: {
          fontWeight: '700',
          fontSize: 10,
          marginBottom: 4
        }
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarLabel: 'Beranda' }} />
      <Tab.Screen name="WorkoutList" component={WorkoutsScreen} options={{ tabBarLabel: 'Olahraga' }} />
      <Tab.Screen name="Report" component={ReportScreen} options={{ tabBarLabel: 'Laporan' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: 'Pengaturan' }} />
    </Tab.Navigator>
  );
}

import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export default function AppNavigator() {
  const [isReady, setIsReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);

  const checkMandatoryPermissions = async () => {
    try {
      const status = await DetoxService.checkPermissions();
      // Izin WAJIB: Tanpa ini, fitur pembatasan tidak jalan sama sekali.
      if (!status.usageStats || !status.overlay) {
        if (navigationRef.isReady()) {
           const currentRoute = navigationRef.getCurrentRoute()?.name;
           if (currentRoute !== 'Permissions') {
              (navigationRef as any).navigate('Permissions');
           }
        }
        return false;
      }
      return true;
    } catch (e) {
      return false;
    }
  };

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && isReady) {
        checkMandatoryPermissions();
      }
    });

    const init = async () => {
      try {
        const hasFinishedOnboarding = await DetoxService.hasFinishedOnboarding();
        const status = await DetoxService.checkPermissions();
        const mandatoryGranted = status.usageStats && status.overlay;
        
        if (mandatoryGranted) {
           await DetoxService.startForegroundService();
        }
        
        if (!hasFinishedOnboarding) {
            setInitialRoute('Onboarding');
        } else {
            setInitialRoute(mandatoryGranted ? 'MainTabs' : 'Permissions');
        }
        
        setIsReady(true);
        
        const route = await DetoxService.getInitialRoute();
        if (route === 'WorkoutList' && mandatoryGranted) {
            const timer = setInterval(() => {
                if (navigationRef.isReady()) {
                    (navigationRef as any).navigate('MainTabs', { screen: 'WorkoutList' });
                    clearInterval(timer);
                }
            }, 100);
            setTimeout(() => clearInterval(timer), 3000);
        }
      } catch (e) {
        setInitialRoute('Permissions');
        setIsReady(true);
      }
    };
    init();

    return () => {
      subscription.remove();
    };
  }, [isReady]);

  if (!isReady || !initialRoute) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#14B8A6" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator 
        initialRouteName={initialRoute}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#FFFFFF' }
        }}
      >
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Permissions" component={PermissionsOnboarding} />
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen name="AppLimiter" component={AppLimiterScreen} />
        <Stack.Screen name="CameraTest" component={CameraTestScreen} />
        <Stack.Screen name="WalkingSession" component={WalkingSessionScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
