import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { StorageService } from '../services/storage';
import { MemeGrid } from '../components/MemeGrid';
import { MemePreview } from '../components/MemePreview';
import { Meme } from '../types/meme';

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
  const [sourcePosition, setSourcePosition] = useState<Position | null>(null);
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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
        allowsEditing: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        await storageService.saveMeme(asset.uri);
        loadMemes();
      }
    } catch (error) {
      Alert.alert('错误', '添加图片失败');
    }
  };

  const handleMemePress = (meme: Meme, position: Position) => {
    setSelectedMeme(meme);
    setSourcePosition(position);
    setPreviewVisible(true);
  };

  const handleClosePreview = () => {
    setPreviewVisible(false);
    setSelectedMeme(null);
    setSourcePosition(null);
  };

  const handleMemeLongPress = (meme: Meme) => {
    Alert.alert(
      '操作',
      '选择要执行的操作',
      [
        {
          text: '保存到相册',
          onPress: async () => {
            try {
              await storageService.saveToGallery(meme);
              Alert.alert('成功', '图片已保存到相册');
            } catch (error) {
              Alert.alert('错误', '保存到相册失败');
            }
          },
        },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              await storageService.deleteMeme(meme.id);
              loadMemes();
            } catch (error) {
              Alert.alert('错误', '删除图片失败');
            }
          },
        },
        {
          text: '取消',
          style: 'cancel',
        },
      ],
    );
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
      <MemeGrid
        memes={memes}
        onMemePress={handleMemePress}
        onMemeLongPress={handleMemeLongPress}
      />
      <TouchableOpacity style={styles.addButton} onPress={handleAddMeme}>
        <Text style={styles.addButtonText}>+</Text>
      </TouchableOpacity>
      <MemePreview
        meme={selectedMeme}
        visible={previewVisible}
        onClose={handleClosePreview}
        // sourcePosition={sourcePosition}
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
}); 