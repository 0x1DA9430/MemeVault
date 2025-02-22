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
import { SettingsService } from '../services/settings';
import { AutoTagSettings } from '../types/meme';

export const SettingsScreen: React.FC = () => {
  const [settings, setSettings] = useState<AutoTagSettings>({
    enabled: false,
    apiKey: '',
    maxTags: 6
  });
  const [isEditing, setIsEditing] = useState(false);
  const settingsService = SettingsService.getInstance();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const savedSettings = await settingsService.loadSettings();
    setSettings(savedSettings);
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

  const handleSave = async () => {
    try {
      await settingsService.saveSettings(settings);
      setIsEditing(false);
      Alert.alert('成功', '设置已保存');
    } catch (error) {
      Alert.alert('错误', '保存设置失败');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>自动标签设置</Text>
        
        <View style={styles.row}>
          <Text style={styles.label}>启用自动标签</Text>
          <Switch
            value={settings.enabled}
            onValueChange={toggleEnabled}
          />
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>API密钥</Text>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => setIsEditing(!isEditing)}
          >
            <Text style={styles.editButtonText}>
              {isEditing ? '取消' : '编辑'}
            </Text>
          </TouchableOpacity>
        </View>

        {isEditing ? (
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={settings.apiKey}
              onChangeText={(text) => setSettings({ ...settings, apiKey: text })}
              placeholder="输入API密钥"
              secureTextEntry
            />
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
            >
              <Text style={styles.saveButtonText}>保存</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.apiKeyMask}>
            {settings.apiKey ? '******' : '未设置'}
          </Text>
        )}

        <View style={styles.row}>
          <Text style={styles.label}>最大标签数量</Text>
          <TextInput
            style={styles.numberInput}
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

      <View style={styles.section}>
        <Text style={styles.description}>
          启用自动标签后，系统将在导入新图片时自动生成标签。系统会分析图片中的文字、情绪、主体和含义，生成相应的标签。您随时可以手动编辑这些标签。
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
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
    color: '#666',
    lineHeight: 20,
  },
  editButton: {
    padding: 8,
  },
  editButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  saveButton: {
    backgroundColor: '#007AFF',
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
    color: '#666',
    marginBottom: 16,
  },
  numberInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 8,
    width: 50,
    textAlign: 'center',
    fontSize: 16,
  },
}); 