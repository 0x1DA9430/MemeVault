import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SettingsService } from '../services/settings';
import { StorageService } from '../services/storage';
import { TagNormalizer } from '../services/tagNormalizer';
import { AutoTagSettings, ThemeMode } from '../types/meme';
import { useTheme } from '../contexts/ThemeContext';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RootStackParamList = {
  Settings: undefined;
  UsageStats: {
    type: 'memes' | 'tags' | 'overview';
  };
  CloudStorage: undefined;
  Home: undefined;
};

type SettingsScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Settings'>;
};

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
  const { isDarkMode, themeMode: currentThemeMode, setThemeMode } = useTheme();
  const [settings, setSettings] = useState<AutoTagSettings>({
    enabled: false,
    apiKey: '',
    maxTags: 6,
    themeMode: 'auto',
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isMergingTags, setIsMergingTags] = useState(false);
  const [isDeletingAllData, setIsDeletingAllData] = useState(false);
  const settingsService = SettingsService.getInstance();
  const storageService = StorageService.getInstance();
  const tagNormalizer = TagNormalizer.getInstance();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const savedSettings = await settingsService.getSettings();
    setSettings(savedSettings);
  };

  const handleSave = async () => {
    try {
      await settingsService.saveSettings(settings);
      setIsEditing(false);
      Alert.alert('成功', '设置已保存');
    } catch (error) {
      Alert.alert('错误', '保存设置失败');
    }
  };

  const toggleEnabled = async (value: boolean) => {
    if (value && !settings.apiKey) {
      Alert.alert('提示', '请先设置API密钥');
      return;
    }
    try {
      const newSettings = { ...settings, enabled: value };
      await settingsService.saveSettings(newSettings);
      setSettings(newSettings);
    } catch (error) {
      Alert.alert('错误', '保存设置失败');
    }
  };

  const handleThemeChange = async (mode: ThemeMode) => {
    try {
      await setThemeMode(mode);
      setSettings(prev => ({ ...prev, themeMode: mode }));
    } catch (error) {
      Alert.alert('错误', '保存主题设置失败');
    }
  };

  const getThemeIcon = (mode: ThemeMode) => {
    switch (mode) {
      case 'light':
        return 'sunny';
      case 'dark':
        return 'moon';
      default:
        return 'contrast';
    }
  };

  const getThemeText = (mode: ThemeMode) => {
    switch (mode) {
      case 'light':
        return '浅色';
      case 'dark':
        return '深色';
      default:
        return '跟随系统';
    }
  };

  const handleMergeTags = async () => {
    try {
      setIsMergingTags(true);
      const allTags = await storageService.getAllTags();
      const normalizedTags = tagNormalizer.normalizeTags(allTags);
      
      // 获取所有图片
      const allMemes = await storageService.getAllMemes();
      
      // 更新每个图片的标签
      for (const meme of allMemes) {
        const newTags = tagNormalizer.normalizeTags(meme.tags);
        if (JSON.stringify(newTags) !== JSON.stringify(meme.tags)) {
          await storageService.updateMemeTags(meme.id, newTags);
        }
      }

      Alert.alert(
        '标签合并完成',
        `已将 ${allTags.length} 个标签合并为 ${normalizedTags.length} 个标签`
      );
    } catch (error) {
      Alert.alert('错误', '合并标签失败');
    } finally {
      setIsMergingTags(false);
    }
  };

  const confirmMergeTags = () => {
    Alert.alert(
      '合并标签',
      '此操作将自动合并所有相似的标签，确定要继续吗？',
      [
        {
          text: '取消',
          style: 'cancel'
        },
        {
          text: '确定',
          onPress: handleMergeTags
        }
      ]
    );
  };

  const confirmDeleteAllData = () => {
    Alert.alert(
      '警告',
      '此操作将删除所有表情包、使用记录和设置，且无法恢复。确定要继续吗？',
      [
        {
          text: '取消',
          style: 'cancel',
        },
        {
          text: '删除',
          style: 'destructive',
          onPress: handleDeleteAllData,
        },
      ],
      { cancelable: true }
    );
  };

  const handleDeleteAllData = async () => {
    try {
      setIsDeletingAllData(true);
      await storageService.deleteAllData(() => {
        console.log('数据删除完成，准备刷新UI');
      });
      Alert.alert('成功', '所有数据已删除', [
        {
          text: '确定',
          onPress: () => {
            navigation.reset({
              index: 0,
              routes: [{ name: 'Home' }],
            });
          }
        }
      ]);
    } catch (error) {
      Alert.alert('错误', '删除数据失败');
      console.error('删除所有数据时出错:', error);
    } finally {
      setIsDeletingAllData(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: isDarkMode ? '#000' : '#fff' }]}>
      <View style={[styles.section, { borderBottomColor: isDarkMode ? '#333' : '#f0f0f0' }]}>
        <Text style={[styles.sectionTitle, { color: isDarkMode ? '#fff' : '#000' }]}>外观</Text>
        <View style={styles.themeContainer}>
          {(['auto', 'light', 'dark'] as ThemeMode[]).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[
                styles.themeButton,
                { backgroundColor: isDarkMode ? '#333' : '#f0f0f0' },
                currentThemeMode === mode && {
                  backgroundColor: isDarkMode ? '#0A84FF' : '#007AFF',
                },
              ]}
              onPress={() => handleThemeChange(mode)}
            >
              <Ionicons
                name={getThemeIcon(mode)}
                size={24}
                color={currentThemeMode === mode ? '#fff' : (isDarkMode ? '#fff' : '#000')}
              />
              <Text
                style={[
                  styles.themeButtonText,
                  { color: isDarkMode ? '#fff' : '#000' },
                  currentThemeMode === mode && { color: '#fff' },
                ]}
              >
                {getThemeText(mode)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={[styles.section, { borderBottomColor: isDarkMode ? '#333' : '#f0f0f0' }]}>
        <Text style={[styles.sectionTitle, { color: isDarkMode ? '#fff' : '#000' }]}>自动标签</Text>
        
        <View style={styles.settingGroup}>
          <View style={styles.row}>
            <Text style={[styles.label, { color: isDarkMode ? '#fff' : '#000' }]}>启用自动标签</Text>
            <Switch
              value={settings.enabled}
              onValueChange={toggleEnabled}
              trackColor={{ false: isDarkMode ? '#333' : '#e0e0e0', true: '#34C759' }}
            />
          </View>

          <View style={styles.row}>
            <Text style={[styles.label, { color: isDarkMode ? '#fff' : '#000' }]}>最大标签数量</Text>
            <TextInput
              style={[
                styles.numberInput,
                {
                  borderColor: isDarkMode ? '#333' : '#ddd',
                  backgroundColor: isDarkMode ? '#1c1c1c' : '#fff',
                  color: isDarkMode ? '#fff' : '#000',
                }
              ]}
              value={settings.maxTags.toString()}
              onChangeText={(text) => {
                const num = parseInt(text) || 6;
                setSettings({ ...settings, maxTags: Math.min(Math.max(1, num), 6) });
              }}
              keyboardType="number-pad"
              maxLength={1}
            />
          </View>

          <View style={[styles.apiKeySection, { borderTopColor: isDarkMode ? '#333' : '#e0e0e0' }]}>
            <View style={styles.row}>
              <Text style={[styles.label, { color: isDarkMode ? '#fff' : '#000' }]}>OpenAI API密钥</Text>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => setIsEditing(!isEditing)}
              >
                <Text style={[styles.editButtonText, { color: isDarkMode ? '#0A84FF' : '#007AFF' }]}>
                  {isEditing ? '取消' : '编辑'}
                </Text>
              </TouchableOpacity>
            </View>

            {isEditing ? (
              <View style={styles.inputContainer}>
                <TextInput
                  style={[
                    styles.input,
                    {
                      borderColor: isDarkMode ? '#333' : '#ddd',
                      backgroundColor: isDarkMode ? '#1c1c1c' : '#fff',
                      color: isDarkMode ? '#fff' : '#000',
                    }
                  ]}
                  value={settings.apiKey}
                  onChangeText={(text) => setSettings({ ...settings, apiKey: text })}
                  placeholder="输入API密钥"
                  placeholderTextColor={isDarkMode ? '#666' : '#999'}
                  secureTextEntry
                />
                <TouchableOpacity
                  style={[styles.saveButton, { backgroundColor: isDarkMode ? '#0A84FF' : '#007AFF' }]}
                  onPress={handleSave}
                >
                  <Text style={styles.saveButtonText}>保存</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={[styles.apiKeyMask, { color: isDarkMode ? '#666' : '#999' }]}>
                {settings.apiKey ? '******' : '未设置'}
              </Text>
            )}
          </View>
        </View>

        <Text style={[styles.description, { color: isDarkMode ? '#666' : '#666' }]}>
          启用后，系统将在导入新图片时自动分析图片内容并生成标签（最多6个）。您随时可以手动编辑这些标签。
        </Text>
      </View>

      <View style={[styles.section, { borderBottomColor: isDarkMode ? '#333' : '#f0f0f0' }]}>
        <Text style={[styles.sectionTitle, { color: isDarkMode ? '#fff' : '#000' }]}>标签管理</Text>
        
        <TouchableOpacity
          style={[
            styles.mergeButton,
            { backgroundColor: isDarkMode ? '#333' : '#f0f0f0' },
            isMergingTags && { opacity: 0.5 }
          ]}
          onPress={confirmMergeTags}
          disabled={isMergingTags}
        >
          <View style={styles.mergeButtonContent}>
            {isMergingTags ? (
              <ActivityIndicator size="small" color={isDarkMode ? '#fff' : '#007AFF'} />
            ) : (
              <Ionicons 
                name="git-merge-outline" 
                size={24} 
                color={isDarkMode ? '#fff' : '#007AFF'} 
              />
            )}
            <Text style={[
              styles.mergeButtonText,
              { color: isDarkMode ? '#fff' : '#007AFF' }
            ]}>
              {isMergingTags ? '合并中...' : '合并相似标签'}
            </Text>
          </View>
        </TouchableOpacity>

        <Text style={[styles.description, { color: isDarkMode ? '#666' : '#666' }]}>
          点击按钮将自动合并相似的标签，例如"搞笑"和"幽默"会被合并为同一个标签。此操作不可撤销。
        </Text>
      </View>

      <View style={[styles.section, { borderBottomColor: isDarkMode ? '#333' : '#f0f0f0' }]}>
        <Text style={[styles.sectionTitle, { color: isDarkMode ? '#fff' : '#000' }]}>云存储</Text>
        
        <TouchableOpacity
          style={[
            styles.statButton,
            { backgroundColor: isDarkMode ? '#333' : '#f0f0f0' }
          ]}
          onPress={() => navigation.navigate('CloudStorage')}
        >
          <View style={styles.statButtonContent}>
            <Ionicons 
              name="cloud-upload-outline" 
              size={24} 
              color={isDarkMode ? '#fff' : '#007AFF'} 
            />
            <Text style={[
              styles.statButtonText,
              { color: isDarkMode ? '#fff' : '#007AFF' }
            ]}>云存储设置</Text>
            <Ionicons 
              name="chevron-forward" 
              size={20} 
              color={isDarkMode ? '#666' : '#999'} 
              style={styles.statButtonArrow}
            />
          </View>
        </TouchableOpacity>

        <Text style={[styles.description, { color: isDarkMode ? '#666' : '#666' }]}>
          配置云存储服务，自动备份您的表情包到云端。支持多种免费图床服务。
        </Text>
      </View>

      <View style={[styles.section, { borderBottomColor: isDarkMode ? '#333' : '#f0f0f0' }]}>
        <Text style={[styles.sectionTitle, { color: isDarkMode ? '#fff' : '#000' }]}>使用统计</Text>
        
        <TouchableOpacity
          style={[
            styles.statButton,
            { backgroundColor: isDarkMode ? '#333' : '#f0f0f0' }
          ]}
          onPress={() => navigation.navigate('UsageStats', { type: 'memes' })}
        >
          <View style={styles.statButtonContent}>
            <Ionicons 
              name="bar-chart-outline" 
              size={24} 
              color={isDarkMode ? '#fff' : '#007AFF'} 
            />
            <Text style={[
              styles.statButtonText,
              { color: isDarkMode ? '#fff' : '#007AFF' }
            ]}>常用表情包排行</Text>
            <Ionicons 
              name="chevron-forward" 
              size={20} 
              color={isDarkMode ? '#666' : '#999'} 
              style={styles.statButtonArrow}
            />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.statButton,
            { backgroundColor: isDarkMode ? '#333' : '#f0f0f0' }
          ]}
          onPress={() => navigation.navigate('UsageStats', { type: 'tags' })}
        >
          <View style={styles.statButtonContent}>
            <Ionicons 
              name="pricetags-outline" 
              size={24} 
              color={isDarkMode ? '#fff' : '#007AFF'} 
            />
            <Text style={[
              styles.statButtonText,
              { color: isDarkMode ? '#fff' : '#007AFF' }
            ]}>标签使用分析</Text>
            <Ionicons 
              name="chevron-forward" 
              size={20} 
              color={isDarkMode ? '#666' : '#999'} 
              style={styles.statButtonArrow}
            />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.statButton,
            { backgroundColor: isDarkMode ? '#333' : '#f0f0f0' }
          ]}
          onPress={() => navigation.navigate('UsageStats', { type: 'overview' })}
        >
          <View style={styles.statButtonContent}>
            <Ionicons 
              name="stats-chart" 
              size={24} 
              color={isDarkMode ? '#fff' : '#007AFF'} 
            />
            <Text style={[
              styles.statButtonText,
              { color: isDarkMode ? '#fff' : '#007AFF' }
            ]}>数据总览</Text>
            <Ionicons 
              name="chevron-forward" 
              size={20} 
              color={isDarkMode ? '#666' : '#999'} 
              style={styles.statButtonArrow}
            />
          </View>
        </TouchableOpacity>

        <Text style={[styles.description, { color: isDarkMode ? '#666' : '#666' }]}>
          查看表情包使用频率、标签分布等数据统计信息，帮助您更好地管理表情包。
        </Text>
      </View>

      <View style={[styles.section, { borderBottomColor: isDarkMode ? '#333' : '#f0f0f0' }]}>
        <Text style={[styles.sectionTitle, { color: isDarkMode ? '#fff' : '#000' }]}>危险操作</Text>
        
        <TouchableOpacity
          style={[
            styles.mergeButton,
            { backgroundColor: isDarkMode ? '#333' : '#f0f0f0' },
            isDeletingAllData && { opacity: 0.5 }
          ]}
          onPress={confirmDeleteAllData}
          disabled={isDeletingAllData}
        >
          <View style={styles.mergeButtonContent}>
            {isDeletingAllData ? (
              <ActivityIndicator size="small" color={isDarkMode ? '#ff453a' : '#FF3B30'} />
            ) : (
              <Ionicons 
                name="trash-outline" 
                size={24} 
                color={isDarkMode ? '#ff453a' : '#FF3B30'} 
              />
            )}
            <Text style={[
              styles.mergeButtonText,
              { color: isDarkMode ? '#ff453a' : '#FF3B30' }
            ]}>删除所有数据</Text>
          </View>
        </TouchableOpacity>

        <Text style={[styles.description, { color: isDarkMode ? '#666' : '#666' }]}>
          此操作将删除所有表情包、使用记录和设置，且无法恢复。请谨慎操作。
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  settingGroup: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    marginBottom: 16,
  },
  themeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  themeButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  themeButtonText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  apiKeySection: {
    borderTopWidth: 1,
    marginTop: 8,
    paddingTop: 8,
  },
  editButton: {
    padding: 8,
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  inputContainer: {
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  saveButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  apiKeyMask: {
    fontSize: 16,
    marginTop: 4,
  },
  numberInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    width: 50,
    textAlign: 'center',
    fontSize: 16,
  },
  mergeButton: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  mergeButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mergeButtonText: {
    fontSize: 16,
    marginLeft: 8,
    fontWeight: '500',
  },
  statButton: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  statButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statButtonText: {
    fontSize: 16,
    marginLeft: 12,
    flex: 1,
    fontWeight: '500',
  },
  statButtonArrow: {
    marginLeft: 8,
  },
}); 