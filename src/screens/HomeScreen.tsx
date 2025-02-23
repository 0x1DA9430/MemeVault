import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Alert,
  ActivityIndicator,
  StatusBar,
  ScrollView,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { StorageService } from '../services/storage';
import { MemeGrid } from '../components/MemeGrid';
import { MemePreview } from '../components/MemePreview';
import { Meme } from '../types/meme';
import { Ionicons } from '@expo/vector-icons';
import { TagQueueService } from '../services/tagQueue';
import { useTheme } from '../contexts/ThemeContext';
import { globalEventEmitter } from './CloudStorageScreen';

interface Position {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const HomeScreen: React.FC = () => {
  const { isDarkMode } = useTheme();
  const [memes, setMemes] = useState<Meme[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMeme, setSelectedMeme] = useState<Meme | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMemes, setSelectedMemes] = useState<Set<string>>(new Set());
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [allTags, setAllTags] = useState<string[]>([]);
  const [filteredMemes, setFilteredMemes] = useState<Meme[]>([]);
  const [isTagListExpanded, setIsTagListExpanded] = useState(false);
  const [showingFavorites, setShowingFavorites] = useState(false);
  const storageService = StorageService.getInstance();
  const tagQueueService = TagQueueService.getInstance();

  useEffect(() => {
    if (Platform.OS === 'android') {
      if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
      }
    }
  }, []);

  useEffect(() => {
    (async () => {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('权限错误', '需要相册权限才能使用完整功能');
      }
      loadMemes();
    })();

    // 添加标签更新监听器
    const handleTagsUpdate = () => {
      loadMemes();
    };
    tagQueueService.addTagsUpdateListener(handleTagsUpdate);

    // 添加云端恢复监听器
    globalEventEmitter.on('memesUpdated', loadMemes);

    return () => {
      tagQueueService.removeTagsUpdateListener(handleTagsUpdate);
      globalEventEmitter.off('memesUpdated', loadMemes);
    };
  }, []);

  useEffect(() => {
    if (selectedTags.size === 0) {
      setFilteredMemes(memes);
    } else {
      const filtered = memes.filter(meme =>
        Array.from(selectedTags).every(tag => meme.tags.includes(tag))
      );
      setFilteredMemes(filtered);
    }
  }, [memes, selectedTags]);

  const loadMemes = async () => {
    try {
      const loadedMemes = await storageService.getAllMemes();
      setMemes(loadedMemes);
      const tags = await storageService.getAllTags();
      setAllTags(tags);
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

  const toggleTag = (tag: string) => {
    const newSelectedTags = new Set(selectedTags);
    if (newSelectedTags.has(tag)) {
      newSelectedTags.delete(tag);
    } else {
      newSelectedTags.add(tag);
    }
    setSelectedTags(newSelectedTags);
  };

  const clearTagFilter = () => {
    setSelectedTags(new Set());
  };

  const toggleTagList = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsTagListExpanded(!isTagListExpanded);
  };

  const handleToggleFavorites = async () => {
    setLoading(true);
    try {
      if (showingFavorites) {
        const allMemes = await storageService.getAllMemes();
        setMemes(allMemes);
        setShowingFavorites(false);
      } else {
        const favorites = await storageService.getFavoriteMemes();
        setMemes(favorites);
        setShowingFavorites(true);
      }
    } catch (error) {
      Alert.alert('错误', '加载收藏失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExportSelected = async () => {
    if (selectedMemes.size === 0) {
      Alert.alert('提示', '请先选择要导出的表情包');
      return;
    }

    try {
      setLoading(true);
      const exportPath = await storageService.exportMemes(Array.from(selectedMemes));
      await Sharing.shareAsync(exportPath, {
        mimeType: 'application/zip',
        dialogTitle: '导出表情包'
      });
      setIsSelectionMode(false);
      setSelectedMemes(new Set());
    } catch (error) {
      Alert.alert('错误', '导出失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckDuplicates = async () => {
    try {
      setLoading(true);
      const duplicates = await storageService.findDuplicateMemes();
      
      if (duplicates.length === 0) {
        Alert.alert('提示', '未发现重复的表情包');
        return;
      }

      // 选中所有重复的表情包
      const duplicateIds = new Set<string>();
      duplicates.forEach(group => {
        group.duplicates.forEach(meme => {
          duplicateIds.add(meme.id);
        });
      });

      setSelectedMemes(duplicateIds);
      setIsSelectionMode(true);
      Alert.alert(
        '发现重复表情包',
        `发现 ${duplicateIds.size} 个重复的表情包，已为您选中，可以选择删除或导出。`
      );
    } catch (error) {
      Alert.alert('错误', '检查重复失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: isDarkMode ? '#000' : '#fff' }]}>
        <ActivityIndicator size="large" color={isDarkMode ? '#fff' : '#0000ff'} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#000' : '#fff' }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      
      {isSelectionMode ? (
        <View style={[styles.selectionHeader, { 
          backgroundColor: isDarkMode ? '#1c1c1c' : '#fff',
          borderBottomColor: isDarkMode ? '#333' : '#E5E5E5',
        }]}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={exitSelectionMode}
          >
            <Ionicons name="close" size={24} color={isDarkMode ? '#fff' : '#007AFF'} />
          </TouchableOpacity>
          
          <View style={styles.headerActions}>
            <Text style={[styles.selectionCount, { color: isDarkMode ? '#fff' : '#000' }]}>
              已选择 {selectedMemes.size} 项
            </Text>
            <TouchableOpacity
              style={[
                styles.headerButton,
                styles.headerActionButton,
                { backgroundColor: isDarkMode ? '#333' : '#F0F0F0' }
              ]}
              onPress={handleSelectAll}
            >
              <Text style={[styles.headerActionText, { color: isDarkMode ? '#fff' : '#007AFF' }]}>全选</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.headerButton,
                styles.headerActionButton,
                { backgroundColor: isDarkMode ? '#333' : '#F0F0F0' }
              ]}
              onPress={handleExportSelected}
            >
              <Text style={[styles.headerActionText, { color: isDarkMode ? '#fff' : '#007AFF' }]}>导出</Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleDeleteSelected}
          >
            <Ionicons name="trash-outline" size={24} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.actionHeader, {
          backgroundColor: isDarkMode ? '#1c1c1c' : '#fff',
          borderBottomColor: isDarkMode ? '#333' : '#E5E5E5',
        }]}>
          <TouchableOpacity
            style={[styles.actionButton, showingFavorites && styles.actionButtonActive]}
            onPress={handleToggleFavorites}
          >
            <Ionicons 
              name={showingFavorites ? "star" : "star-outline"} 
              size={20} 
              color={showingFavorites ? "#FFD700" : (isDarkMode ? '#fff' : '#666')} 
            />
            <Text style={[
              styles.actionButtonText,
              { color: isDarkMode ? '#fff' : '#666' },
              showingFavorites && styles.actionButtonTextActive
            ]}>收藏</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, isTagListExpanded && styles.actionButtonActive]}
            onPress={toggleTagList}
          >
            <Ionicons 
              name="pricetag-outline" 
              size={20} 
              color={isDarkMode ? '#fff' : '#666'} 
            />
            <Text style={[
              styles.actionButtonText,
              { color: isDarkMode ? '#fff' : '#666' },
              isTagListExpanded && styles.actionButtonTextActive
            ]}>标签</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleCheckDuplicates}
          >
            <Ionicons 
              name="copy-outline" 
              size={20} 
              color={isDarkMode ? '#fff' : '#666'} 
            />
            <Text style={[
              styles.actionButtonText,
              { color: isDarkMode ? '#fff' : '#666' }
            ]}>查重</Text>
          </TouchableOpacity>
        </View>
      )}

      {isTagListExpanded && (
        <ScrollView 
          style={[styles.tagSection, { 
            borderBottomColor: isDarkMode ? '#333' : '#E5E5E5',
            backgroundColor: isDarkMode ? '#1c1c1c' : '#fff'
          }]}
        >
          <View style={styles.tagScrollContent}>
            {allTags.map((tag, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.tagButton,
                  { backgroundColor: isDarkMode ? '#333' : '#F0F0F0' },
                  selectedTags.has(tag) && styles.tagButtonSelected
                ]}
                onPress={() => toggleTag(tag)}
              >
                <Text style={[
                  styles.tagButtonText,
                  { color: isDarkMode ? '#fff' : '#666' },
                  selectedTags.has(tag) && styles.tagButtonTextSelected
                ]}>{tag}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      <MemeGrid
        memes={filteredMemes}
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
        onTagsUpdated={loadMemes}
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
  tagSection: {
    maxHeight: 200,
    borderBottomWidth: 1,
  },
  tagHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  tagHeaderText: {
    fontSize: 16,
    fontWeight: '500',
  },
  expandButton: {
    padding: 8,
  },
  tagScrollView: {
    maxHeight: 50,
  },
  tagScrollContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
  },
  tagButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginHorizontal: 4,
    marginVertical: 4,
  },
  tagButtonSelected: {
    backgroundColor: '#007AFF',
  },
  tagButtonText: {
    fontSize: 14,
  },
  tagButtonTextSelected: {
    color: '#fff',
  },
  clearTagButton: {
    padding: 8,
    marginLeft: 8,
    justifyContent: 'center',
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderBottomWidth: 1,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 16,
    marginRight: 8,
  },
  actionButtonActive: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
  },
  actionButtonText: {
    fontSize: 14,
    marginLeft: 4,
  },
  actionButtonTextActive: {
    color: '#FFD700',
  },
}); 