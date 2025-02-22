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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SettingsService } from '../services/settings';
import { AutoTagSettings, ThemeMode } from '../types/meme';
import { useTheme } from '../contexts/ThemeContext';

export const SettingsScreen: React.FC = () => {
  const { isDarkMode, themeMode: currentThemeMode, setThemeMode } = useTheme();
  const [settings, setSettings] = useState<AutoTagSettings>({
    enabled: false,
    apiKey: '',
    maxTags: 6,
    themeMode: 'auto',
  });
  const [isEditing, setIsEditing] = useState(false);
  const settingsService = SettingsService.getInstance();

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
        <Text style={[styles.sectionTitle, { color: isDarkMode ? '#fff' : '#000' }]}>自动标签设置</Text>
        
        <View style={styles.row}>
          <Text style={[styles.label, { color: isDarkMode ? '#fff' : '#000' }]}>启用自动标签</Text>
          <Switch
            value={settings.enabled}
            onValueChange={toggleEnabled}
          />
        </View>

        <View style={styles.row}>
          <Text style={[styles.label, { color: isDarkMode ? '#fff' : '#000' }]}>API密钥</Text>
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
      </View>

      <View style={[styles.section, { borderBottomColor: isDarkMode ? '#333' : '#f0f0f0' }]}>
        <Text style={[styles.description, { color: isDarkMode ? '#666' : '#666' }]}>
          启用自动标签后，系统将在导入新图片时自动生成标签。系统会分析图片中的文字、情绪、主体和含义，生成相应的标签。您随时可以手动编辑这些标签。
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
    fontSize: 18,
    fontWeight: 'bold',
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
    padding: 12,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  themeButtonText: {
    marginTop: 8,
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  editButton: {
    padding: 8,
  },
  editButtonText: {
    fontSize: 16,
  },
  inputContainer: {
    marginBottom: 16,
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
    fontWeight: 'bold',
  },
  apiKeyMask: {
    fontSize: 16,
    marginBottom: 16,
  },
  numberInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    width: 50,
    textAlign: 'center',
    fontSize: 16,
  },
}); 