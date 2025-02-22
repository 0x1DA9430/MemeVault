import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Alert,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { StorageService } from '../services/storage';
import { MemeGrid } from '../components/MemeGrid';
import { MemePreview } from '../components/MemePreview';
import { Meme } from '../types/meme';
import { Ionicons } from '@expo/vector-icons';

interface Position {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const HomeScreen: React.FC = () => {
  const [memes, setMemes] = useState<Meme[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMeme, setSelectedMeme] = useState<Meme | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMemes, setSelectedMemes] = useState<Set<string>>(new Set());
  const storageService = StorageService.getInstance();

  useEffect(() => {
    (async () => {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('权限错误', '需要相册权限才能使用完整功能');
      }
      loadMemes();
    })();
  }, []);

  const loadMemes = async () => {
    try {
      const loadedMemes = await storageService.getAllMemes();
      setMemes(loadedMemes);
    } catch (error) {
      Alert.alert('错误', '加载图片失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMeme = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        quality: 1,
        allowsMultipleSelection: true,
      });

      if (!result.canceled && result.assets.length > 0) {
        setLoading(true);
        for (const asset of result.assets) {
          await storageService.saveMeme(asset.uri);
        }
        loadMemes();
      }
    } catch (error) {
      Alert.alert('错误', '添加图片失败');
    } finally {
      setLoading(false);
    }
  };

  const handleMemePress = (meme: Meme, position: Position) => {
    if (isSelectionMode) {
      const newSelected = new Set(selectedMemes);
      if (newSelected.has(meme.id)) {
        newSelected.delete(meme.id);
      } else {
        newSelected.add(meme.id);
      }
      setSelectedMemes(newSelected);
    } else {
      setSelectedMeme(meme);
      setPreviewVisible(true);
    }
  };

  const handleClosePreview = () => {
    setPreviewVisible(false);
    setSelectedMeme(null);
  };

  const handleMemeLongPress = (meme: Meme) => {
    if (!isSelectionMode) {
      setIsSelectionMode(true);
      setSelectedMemes(new Set([meme.id]));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedMemes.size === 0) return;

    Alert.alert(
      '确认删除',
      `确定要删除选中的 ${selectedMemes.size} 张图片吗？`,
      [
        {
          text: '取消',
          style: 'cancel',
        },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              for (const id of selectedMemes) {
                await storageService.deleteMeme(id);
              }
              setSelectedMemes(new Set());
              setIsSelectionMode(false);
              loadMemes();
            } catch (error) {
              Alert.alert('错误', '删除图片失败');
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedMemes(new Set());
  };

  const handleSelectAll = () => {
    const allMemeIds = new Set(memes.map(meme => meme.id));
    setSelectedMemes(allMemeIds);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {isSelectionMode && (
        <View style={styles.selectionHeader}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={exitSelectionMode}
          >
            <Ionicons name="close" size={24} color="#007AFF" />
          </TouchableOpacity>
          
          <View style={styles.headerActions}>
            <Text style={styles.selectionCount}>
              已选择 {selectedMemes.size} 项
            </Text>
            <TouchableOpacity
              style={[styles.headerButton, styles.headerActionButton]}
              onPress={handleSelectAll}
            >
              <Text style={styles.headerActionText}>全选</Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleDeleteSelected}
          >
            <Ionicons name="trash-outline" size={24} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      )}

      <MemeGrid
        memes={memes}
        onMemePress={handleMemePress}
        onMemeLongPress={handleMemeLongPress}
        selectedMemes={selectedMemes}
        isSelectionMode={isSelectionMode}
      />

      <TouchableOpacity
        style={styles.addButton}
        onPress={handleAddMeme}
      >
        <Text style={styles.addButtonText}>+</Text>
      </TouchableOpacity>

      <MemePreview
        meme={selectedMeme}
        visible={previewVisible}
        onClose={handleClosePreview}
        memes={memes}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  addButtonText: {
    fontSize: 32,
    color: '#fff',
    lineHeight: 50,
    paddingBottom: 4,
  },
  selectionHeader: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    backgroundColor: '#fff',
  },
  headerButton: {
    padding: 8,
  },
  selectionCount: {
    fontSize: 16,
    color: '#000',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerActionButton: {
    marginHorizontal: 8,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
  },
  headerActionText: {
    fontSize: 14,
    color: '#007AFF',
  },
}); 