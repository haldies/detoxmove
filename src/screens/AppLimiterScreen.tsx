import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Platform, NativeModules, SafeAreaView, TextInput, ScrollView, Image } from 'react-native';
import { FlashList } from "@shopify/flash-list";
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { RootStackParamList } from '../navigation/AppNavigator';
import DatabaseService from '../services/DatabaseService';
import CustomAlert from '../components/CustomAlert';

const { DetoxService } = NativeModules;

interface AppUsage {
  packageName: string;
  totalTimeInForeground: number;
  lastTimeUsed: number;
  appName?: string;
  category?: string;
  icon?: string;
}

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'AppLimiter'>;
};

const globalIconCache: { [key: string]: string } = {};

const LazyIcon = ({ packageName, isSelected, displayName }: { packageName: string, isSelected: boolean, displayName: string }) => {
  const [icon, setIcon] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    if (globalIconCache[packageName]) {
      setIcon(globalIconCache[packageName]);
      setLoading(false);
      return;
    }

    const fetchIcon = async () => {
      try {
        const base64Icon = await NativeModules.DetoxService.getAppIcon(packageName);
        if (isMounted) {
          globalIconCache[packageName] = base64Icon;
          setIcon(base64Icon);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) setLoading(false);
      }
    };
    fetchIcon();
    return () => { isMounted = false; };
  }, [packageName]);

  return (
    <View style={[styles.iconContainer, { backgroundColor: isSelected ? '#14b8a6' : '#f0fdfa' }]}>
      {loading ? (
        <ActivityIndicator size="small" color="#14b8a6" />
      ) : icon ? (
        <Image 
          key={packageName}
          source={{ uri: `data:image/png;base64,${icon}` }} 
          style={{ width: 40, height: 40, borderRadius: 8 }}
          fadeDuration={0}
        />
      ) : (
        <Text style={[styles.iconText, { color: isSelected ? '#fff' : '#14b8a6' }]}>
          {displayName.charAt(0).toUpperCase()}
        </Text>
      )}
    </View>
  );
};

const AppItem = React.memo(({ item, isSelected, onToggle }: { item: AppUsage, isSelected: boolean, onToggle: (pkg: string) => void }) => {
  const displayName = item.appName && item.appName !== item.packageName 
    ? item.appName 
    : item.packageName.split('.').pop() || item.packageName;
  
  return (
    <TouchableOpacity 
      style={[styles.card, isSelected && styles.selectedCard]} 
      onPress={() => onToggle(item.packageName)}
      activeOpacity={0.7}
    >
      <LazyIcon 
        packageName={item.packageName} 
        isSelected={isSelected} 
        displayName={displayName} 
      />
      <View style={styles.textContainer}>
        <View style={styles.nameRow}>
          <Text style={styles.appName} numberOfLines={1}>{displayName}</Text>
          {item.category && <Text style={styles.categoryBadge}>{item.category}</Text>}
        </View>
        <Text style={styles.packageName} numberOfLines={1}>{item.packageName}</Text>
      </View>
      <View style={styles.checkboxContainer}>
        <Ionicons 
          name={isSelected ? "checkbox" : "square-outline"} 
          size={26} 
          color={isSelected ? "#14b8a6" : "#cbd5e1"} 
        />
      </View>
    </TouchableOpacity>
  );
});

const AppLimiterScreen: React.FC<Props> = ({ navigation }) => {
  const [apps, setApps] = useState<AppUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('Semua');
  const [alertInfo, setAlertInfo] = useState({ visible: false, title: '', message: '', type: 'info' as 'success' | 'error' | 'info', onSuccessClose: false });

  const CATEGORIES = ['Semua', 'Social', 'Games', 'Video', 'Productivity', 'Others'];

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    loadApps();
    loadSavedRestrictions();
  }, []);

  const loadSavedRestrictions = async () => {
    try {
      const saved = await DatabaseService.getSetting('RESTRICTED_APPS');
      if (saved) {
        setSelectedApps(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Gagal memuat pembatasan aplikasi:', e);
    }
  };

  const loadApps = async () => {
    try {
      setLoading(true);
      const data = await NativeModules.DetoxService.getInstalledApps();
      const filtered = data.filter((a: AppUsage) => a.packageName !== 'com.detoxmove');
      const sorted = filtered.sort((a: AppUsage, b: AppUsage) => {
        if (a.category === 'Productivity' && b.category !== 'Productivity') return -1;
        if (a.category !== 'Productivity' && b.category === 'Productivity') return 1;
        return (a.appName || '').localeCompare(b.appName || '');
      });
      setApps(sorted);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredApps = useMemo(() => {
    return apps.filter(app => {
      const matchText = debouncedQuery.toLowerCase();
      const matchesSearch = app.appName?.toLowerCase().includes(matchText) || 
                           app.packageName.toLowerCase().includes(matchText);
      const matchesCategory = activeCategory === 'Semua' || app.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [apps, debouncedQuery, activeCategory]);

  const toggleAppSelection = useCallback((packageName: string) => {
    setSelectedApps(prev => {
      if (prev.includes(packageName)) {
        return prev.filter(p => p !== packageName);
      } else {
        return [...prev, packageName];
      }
    });
  }, []);

  const handleSaveRestrictions = async () => {
    try {
      await DatabaseService.setSetting('RESTRICTED_APPS', JSON.stringify(selectedApps));
      await DetoxService.setRestrictedApps(selectedApps);
      
      if (selectedApps.length > 0) {
          await DetoxService.startForegroundService().catch(() => {});
      } else {
          await DetoxService.stopForegroundService().catch(() => {});
      }

      setAlertInfo({
        visible: true,
        title: 'Berhasil',
        message: `${selectedApps.length} aplikasi telah dibatasi.`,
        type: 'success',
        onSuccessClose: true
      });
    } catch (err) {
      console.error(err);
      setAlertInfo({
        visible: true,
        title: 'Error',
        message: 'Gagal menyimpan pembatasan.',
        type: 'error',
        onSuccessClose: false
      });
    }
  };

  const renderItem = useCallback(({ item }: { item: AppUsage }) => {
    const isSelected = selectedApps.includes(item.packageName);
    return (
      <AppItem 
        item={item} 
        isSelected={isSelected} 
        onToggle={toggleAppSelection} 
      />
    );
  }, [selectedApps, toggleAppSelection]);

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient 
        colors={['#f0fdfa', '#ccfbf1', '#99f6e4']} 
        style={StyleSheet.absoluteFill} 
      />
      
      <View style={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#134e4a" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Batasi Aplikasi</Text>
            <Text style={styles.headerSubtitle}>Pilih aplikasi yang ingin dibatasi</Text>
          </View>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari aplikasi..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.categoriesWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                onPress={() => setActiveCategory(cat)}
                style={[
                  styles.categoryChip,
                  activeCategory === cat && styles.activeCategoryChip
                ]}
              >
                <Text style={[styles.categoryChipText, activeCategory === cat && styles.activeCategoryChipText]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#14b8a6" style={styles.loader} />
        ) : (
          <FlashList
            data={filteredApps}
            keyExtractor={(item) => item.packageName}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            extraData={selectedApps}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={64} color="#ccfbf1" />
                <Text style={styles.emptyText}>Aplikasi tidak ditemukan.</Text>
              </View>
            }
          />
        )}
      </View>

      {selectedApps.length > 0 && (
        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={handleSaveRestrictions}
        >
          <Text style={styles.actionButtonText}>Simpan Pembatasan ({selectedApps.length})</Text>
        </TouchableOpacity>
      )}

      <CustomAlert
        visible={alertInfo.visible}
        title={alertInfo.title}
        message={alertInfo.message}
        type={alertInfo.type}
        onClose={() => {
          setAlertInfo(prev => ({ ...prev, visible: false }));
          if (alertInfo.onSuccessClose) {
            navigation.goBack();
          }
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingTop: 20, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backButton: { marginRight: 16, padding: 4 },
  headerTitle: { color: '#134e4a', fontSize: 24, fontWeight: '800' },
  headerSubtitle: { color: '#0d9488', fontSize: 14, fontWeight: '500' },
  searchContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    paddingHorizontal: 16, 
    height: 50,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ccfbf1',
    elevation: 2,
  },
  searchInput: { flex: 1, marginLeft: 10, color: '#134e4a', fontSize: 15, fontWeight: '600' },
  categoriesWrapper: { marginBottom: 16 },
  categoryScroll: { paddingRight: 20 },
  categoryChip: { 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    borderRadius: 20, 
    backgroundColor: '#fff', 
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#ccfbf1'
  },
  activeCategoryChip: { backgroundColor: '#14b8a6', borderColor: '#14b8a6' },
  categoryChipText: { color: '#0d9488', fontWeight: '700', fontSize: 13 },
  activeCategoryChipText: { color: '#fff' },
  loader: { marginTop: 100 },
  list: { paddingBottom: 100 },
  card: { 
    backgroundColor: '#fff', 
    borderRadius: 20, 
    padding: 14, 
    marginBottom: 12, 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderWidth: 1,
    borderColor: '#f0fdfa',
    elevation: 2,
  },
  selectedCard: { borderColor: '#14b8a6', backgroundColor: '#f0fdfa' },
  iconContainer: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  iconText: { fontSize: 18, fontWeight: '800' },
  textContainer: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  appName: { color: '#0f172a', fontSize: 16, fontWeight: '700', flexShrink: 1 },
  categoryBadge: { 
    backgroundColor: '#f0fdfa', 
    color: '#0d9488', 
    fontSize: 10, 
    fontWeight: '800', 
    paddingHorizontal: 6, 
    paddingVertical: 2, 
    borderRadius: 6,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#ccfbf1'
  },
  packageName: { color: '#64748b', fontSize: 12, marginBottom: 4 },
  usageTime: { color: '#14b8a6', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  checkboxContainer: { marginLeft: 10 },
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#0d9488', fontSize: 15, fontWeight: '600', textAlign: 'center', marginTop: 16 },
  actionButton: { 
    position: 'absolute', bottom: 30, left: 20, right: 20, 
    backgroundColor: '#134e4a', paddingVertical: 18, borderRadius: 20, 
    alignItems: 'center', elevation: 8,
  },
  actionButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' }
});

export default AppLimiterScreen;
