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
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CloudStorageService } from '../services/cloudStorage';
import { CloudStorageConfig, CloudStorageType } from '../types/meme';
import { useTheme } from '../contexts/ThemeContext';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import EventEmitter from 'eventemitter3';

// 创建全局事件发射器
export const globalEventEmitter = new EventEmitter();

type RootStackParamList = {
  Home: undefined;
  Settings: undefined;
  CloudStorage: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const CloudStorageScreen: React.FC = () => {
  const { isDarkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [isRestoring, setIsRestoring] = useState(false);
  const [config, setConfig] = useState<CloudStorageConfig>({
    enabled: false,
    type: 'imgur',
    autoSync: false,
    syncInterval: 120,  // 默认120分钟
    compressionQuality: 0.8,
    deduplication: true,
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const cloudService = CloudStorageService.getInstance();
  const navigation = useNavigation<NavigationProp>();

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const cloudService = await CloudStorageService.getInstance();
      const savedConfig = await cloudService.getConfig();
      setConfig(savedConfig);
    } catch (error) {
      console.error('加载配置失败:', error);
      Alert.alert('错误', '加载配置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const cloudService = await CloudStorageService.getInstance();
      await cloudService.updateConfig(config);
      Alert.alert('成功', '设置已保存');
    } catch (error) {
      console.error('保存设置失败:', error);
      Alert.alert('错误', '保存设置失败');
    }
  };

  const handleSyncAll = async () => {
    try {
      setIsSyncing(true);
      const cloudService = await CloudStorageService.getInstance();
      await cloudService.syncAll();
      Alert.alert('成功', '已开始同步所有表情包');
    } catch (error) {
      Alert.alert('错误', '同步失败');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRestore = async () => {
    try {
      setIsRestoring(true);
      const cloudService = await CloudStorageService.getInstance();
      await cloudService.restoreFromCloud();
      
      // 发送刷新事件
      globalEventEmitter.emit('memesUpdated');
      
      Alert.alert('成功', '已从云端恢复所有表情包', [{
        text: '确定',
        onPress: () => navigation.popToTop()
      }]);
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert('错误', error.message);
      } else {
        Alert.alert('错误', '恢复失败');
      }
    } finally {
      setIsRestoring(false);
    }
  };

  const confirmRestore = () => {
    Alert.alert(
      '从云端恢复',
      '这将从云端下载所有表情包到本地设备，可能需要一些时间。确定要继续吗？',
      [
        {
          text: '取消',
          style: 'cancel'
        },
        {
          text: '确定',
          onPress: handleRestore
        }
      ]
    );
  };

  const renderStorageTypeSection = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: isDarkMode ? '#fff' : '#000' }]}>存储类型</Text>
      {(['github', 'imgur', 'sm.ms', 'custom'] as CloudStorageType[]).map((type) => (
        <TouchableOpacity
          key={type}
          style={[
            styles.typeButton,
            { backgroundColor: isDarkMode ? '#333' : '#f0f0f0' },
            config.type === type && {
              backgroundColor: isDarkMode ? '#0A84FF' : '#007AFF',
            },
          ]}
          onPress={() => setConfig({ ...config, type })}
        >
          <Ionicons
            name={
              type === 'github' ? 'logo-github' :
              type === 'imgur' ? 'image' :
              type === 'sm.ms' ? 'cloud-upload' :
              'server'
            }
            size={24}
            color={config.type === type ? '#fff' : (isDarkMode ? '#fff' : '#000')}
          />
          <Text
            style={[
              styles.typeButtonText,
              { color: isDarkMode ? '#fff' : '#000' },
              config.type === type && { color: '#fff' },
            ]}
          >
            {type === 'github' ? 'GitHub' :
             type === 'imgur' ? 'Imgur (todo)' :
             type === 'sm.ms' ? 'SM.MS (todo)' :
             '自定义图床'}
          </Text>
        </TouchableOpacity>
      ))}

{config.type === 'imgur' && (
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: isDarkMode ? '#fff' : '#000' }]}>API密钥</Text>
          <TextInput
            style={[
              styles.input,
              {
                borderColor: isDarkMode ? '#333' : '#ddd',
                backgroundColor: isDarkMode ? '#1c1c1c' : '#fff',
                color: isDarkMode ? '#fff' : '#000',
              }
            ]}
            value={config.apiKey}
            onChangeText={(text) => setConfig({ ...config, apiKey: text })}
            placeholder="输入Imgur API密钥"
            placeholderTextColor={isDarkMode ? '#666' : '#999'}
            secureTextEntry
          />
        </View>
      )}

      {config.type === 'sm.ms' && (
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: isDarkMode ? '#fff' : '#000' }]}>API密钥</Text>
          <TextInput
            style={[
              styles.input,
              {
                borderColor: isDarkMode ? '#333' : '#ddd',
                backgroundColor: isDarkMode ? '#1c1c1c' : '#fff',
                color: isDarkMode ? '#fff' : '#000',
              }
            ]}
            value={config.apiKey}
            onChangeText={(text) => setConfig({ ...config, apiKey: text })}
            placeholder="输入SM.MS API密钥"
            placeholderTextColor={isDarkMode ? '#666' : '#999'}
            secureTextEntry
          />
        </View>
      )}

      {config.type === 'github' && (
        <>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: isDarkMode ? '#fff' : '#000' }]}>仓库地址</Text>
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: isDarkMode ? '#333' : '#ddd',
                  backgroundColor: isDarkMode ? '#1c1c1c' : '#fff',
                  color: isDarkMode ? '#fff' : '#000',
                }
              ]}
              value={config.githubRepo}
              onChangeText={(text) => setConfig({ ...config, githubRepo: text })}
              placeholder="格式：用户名/仓库名"
              placeholderTextColor={isDarkMode ? '#666' : '#999'}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: isDarkMode ? '#fff' : '#000' }]}>访问令牌</Text>
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: isDarkMode ? '#333' : '#ddd',
                  backgroundColor: isDarkMode ? '#1c1c1c' : '#fff',
                  color: isDarkMode ? '#fff' : '#000',
                }
              ]}
              value={config.githubToken}
              onChangeText={(text) => setConfig({ ...config, githubToken: text })}
              placeholder="输入GitHub访问令牌"
              placeholderTextColor={isDarkMode ? '#666' : '#999'}
              secureTextEntry
            />
          </View>
        </>
      )}

      {config.type === 'custom' && (
        <>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: isDarkMode ? '#fff' : '#000' }]}>API地址</Text>
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: isDarkMode ? '#333' : '#ddd',
                  backgroundColor: isDarkMode ? '#1c1c1c' : '#fff',
                  color: isDarkMode ? '#fff' : '#000',
                }
              ]}
              value={config.apiEndpoint}
              onChangeText={(text) => setConfig({ ...config, apiEndpoint: text })}
              placeholder="输入自定义图床API地址"
              placeholderTextColor={isDarkMode ? '#666' : '#999'}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: isDarkMode ? '#fff' : '#000' }]}>API密钥（可选）</Text>
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: isDarkMode ? '#333' : '#ddd',
                  backgroundColor: isDarkMode ? '#1c1c1c' : '#fff',
                  color: isDarkMode ? '#fff' : '#000',
                }
              ]}
              value={config.apiKey}
              onChangeText={(text) => setConfig({ ...config, apiKey: text })}
              placeholder="输入API密钥（如果需要）"
              placeholderTextColor={isDarkMode ? '#666' : '#999'}
              secureTextEntry
            />
          </View>
        </>
      )}

    </View>
  );

  const renderConfigSection = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: isDarkMode ? '#fff' : '#000' }]}>基本设置</Text>
      
      <View style={styles.switchGroup}>
        <Text style={[styles.label, { color: isDarkMode ? '#fff' : '#000' }]}>启用云存储</Text>
        <Switch
          value={config.enabled}
          onValueChange={(value) => setConfig({ ...config, enabled: value })}
        />
      </View>

      <View style={styles.switchGroup}>
        <Text style={[styles.label, { color: isDarkMode ? '#fff' : '#000' }]}>自动同步</Text>
        <Switch
          value={config.autoSync}
          onValueChange={(value) => setConfig({ ...config, autoSync: value })}
        />
      </View>

      <View style={styles.infoBox}>
        <Text style={[styles.infoText, { color: isDarkMode ? '#999' : '#666' }]}>
          注意：同步功能会使用网络数据，请注意移动数据流量的使用
        </Text>
      </View>

      {config.autoSync && (
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: isDarkMode ? '#fff' : '#000' }]}>同步频率（分钟）</Text>
          <TextInput
            style={[
              styles.input,
              {
                borderColor: isDarkMode ? '#333' : '#ddd',
                backgroundColor: isDarkMode ? '#1c1c1c' : '#fff',
                color: isDarkMode ? '#fff' : '#000',
              }
            ]}
            value={config.syncInterval.toString()}
            onChangeText={(text) => {
              const interval = parseInt(text) || 120;
              setConfig({ ...config, syncInterval: Math.max(1, interval) });  // 最小1分钟
            }}
            keyboardType="number-pad"
            placeholder="默认120分钟"
            placeholderTextColor={isDarkMode ? '#666' : '#999'}
          />
        </View>
      )}

      <View style={styles.row}>
        <Text style={[styles.label, { color: isDarkMode ? '#fff' : '#000' }]}>重复检测</Text>
        <Switch
          value={config.deduplication}
          onValueChange={(value) => setConfig({ ...config, deduplication: value })}
          trackColor={{ false: isDarkMode ? '#333' : '#e0e0e0', true: '#34C759' }}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: isDarkMode ? '#fff' : '#000' }]}>图片压缩质量 (0-1)</Text>
        <TextInput
          style={[
            styles.input,
            {
              borderColor: isDarkMode ? '#333' : '#ddd',
              backgroundColor: isDarkMode ? '#1c1c1c' : '#fff',
              color: isDarkMode ? '#fff' : '#000',
            }
          ]}
          value={config.compressionQuality.toString()}
          onChangeText={(text) => {
            const quality = Math.min(Math.max(parseFloat(text) || 0.8, 0), 1);
            setConfig({ ...config, compressionQuality: quality });
          }}
          keyboardType="decimal-pad"
          placeholder="默认0.8"
          placeholderTextColor={isDarkMode ? '#666' : '#999'}
        />
      </View>

    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: isDarkMode ? '#000' : '#fff' }]}>
        <ActivityIndicator size="large" color={isDarkMode ? '#fff' : '#007AFF'} />
      </View>
    );
  }

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: isDarkMode ? '#000' : '#fff' }]}
      contentContainerStyle={styles.content}
    >
      {renderStorageTypeSection()}
      {renderConfigSection()}

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: isDarkMode ? '#0A84FF' : '#007AFF' }]}
          onPress={handleSave}
        >
          <Text style={styles.buttonText}>保存设置</Text>
        </TouchableOpacity>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[
              styles.buttonHalf,
              { backgroundColor: isDarkMode ? '#333' : '#f0f0f0' },
              isSyncing && { opacity: 0.5 }
            ]}
            onPress={handleSyncAll}
            disabled={isSyncing || !config.enabled}
          >
            <View style={styles.buttonContent}>
              <Ionicons 
                name="cloud-upload-outline" 
                size={20} 
                color={isDarkMode ? '#fff' : '#007AFF'} 
                style={styles.buttonIcon}
              />
              <Text style={[
                styles.buttonText,
                { color: isDarkMode ? '#fff' : '#007AFF' }
              ]}>
                {isSyncing ? '同步中...' : '同步全部'}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.buttonHalf,
              { backgroundColor: isDarkMode ? '#333' : '#f0f0f0' },
              isRestoring && { opacity: 0.5 }
            ]}
            onPress={confirmRestore}
            disabled={isRestoring || !config.enabled}
          >
            <View style={styles.buttonContent}>
              <Ionicons 
                name="cloud-download-outline" 
                size={20} 
                color={isDarkMode ? '#fff' : '#007AFF'} 
                style={styles.buttonIcon}
              />
              <Text style={[
                styles.buttonText,
                { color: isDarkMode ? '#fff' : '#007AFF' }
              ]}>
                {isRestoring ? '恢复中...' : '云端恢复'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  typeButtonText: {
    fontSize: 16,
    marginLeft: 12,
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
  inputGroup: {
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginTop: 8,
  },
  buttonContainer: {
    marginTop: 24,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  buttonHalf: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    marginHorizontal: 6,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: 8,
  },
  switchGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  infoBox: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
}); 