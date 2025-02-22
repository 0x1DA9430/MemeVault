import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StorageService } from '../services/storage';
import { TagService } from '../services/tagService';
import { Meme } from '../types/meme';

interface TagEditorProps {
  meme: Meme;
  onClose: () => void;
  onTagsUpdated: () => void;
}

export const TagEditor: React.FC<TagEditorProps> = ({
  meme,
  onClose,
  onTagsUpdated,
}) => {
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [allTags, setAllTags] = useState<string[]>([]);
  const [suggestions, setsuggestions] = useState<string[]>([]);
  const storageService = StorageService.getInstance();
  const tagService = TagService.getInstance();

  useEffect(() => {
    setTags([...meme.tags]);
    loadAllTags();
  }, [meme]);

  const loadAllTags = async () => {
    const tags = await storageService.getAllTags();
    setAllTags(tags);
  };

  const handleAddTag = () => {
    if (!newTag.trim()) return;
    
    const trimmedTag = newTag.trim();
    if (tags.length >= 6) {
      Alert.alert('提示', '最多只能添加6个标签');
      return;
    }
    
    if (tags.includes(trimmedTag)) {
      Alert.alert('提示', '该标签已存在');
      return;
    }
    
    setTags([...tags, trimmedTag]);
    setNewTag('');
    setsuggestions([]);
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleSave = async () => {
    try {
      await storageService.updateMemeTags(meme.id, tags);
      onTagsUpdated();
      onClose();
    } catch (error) {
      Alert.alert('错误', '保存标签失败');
    }
  };

  const handleInputChange = (text: string) => {
    setNewTag(text);
    if (text.trim()) {
      const matches = allTags.filter(tag => 
        tag.toLowerCase().includes(text.toLowerCase()) &&
        !tags.includes(tag)
      );
      setsuggestions(matches.slice(0, 5));
    } else {
      setsuggestions([]);
    }
  };

  const handleSuggestionPress = (tag: string) => {
    if (tags.length >= 6) {
      Alert.alert('提示', '最多只能添加6个标签');
      return;
    }
    setTags([...tags, tag]);
    setNewTag('');
    setsuggestions([]);
  };

  const handleGenerateTags = async () => {
    try {
      const suggestions = await tagService.generateTags(meme.uri);
      const newTags = suggestions.map(s => s.tag);
      setTags(newTags);
    } catch (error) {
      Alert.alert('错误', '生成标签失败');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>编辑标签</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleGenerateTags}
          >
            <Ionicons name="refresh" size={24} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={onClose}
          >
            <Ionicons name="close" size={24} color="#000" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.tagContainer}>
        <View style={styles.tagList}>
          {tags.map((tag, index) => (
            <View key={index} style={styles.tagItem}>
              <Text style={styles.tagText}>{tag}</Text>
              <TouchableOpacity
                onPress={() => handleRemoveTag(tag)}
                style={styles.removeButton}
              >
                <Ionicons name="close-circle" size={20} color="#666" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={newTag}
          onChangeText={handleInputChange}
          placeholder="添加新标签"
          maxLength={20}
        />
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleAddTag}
        >
          <Text style={styles.addButtonText}>添加</Text>
        </TouchableOpacity>
      </View>

      {suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          {suggestions.map((suggestion, index) => (
            <TouchableOpacity
              key={index}
              style={styles.suggestionItem}
              onPress={() => handleSuggestionPress(suggestion)}
            >
              <Text style={styles.suggestionText}>{suggestion}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={styles.saveButton}
        onPress={handleSave}
      >
        <Text style={styles.saveButtonText}>保存</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerButtons: {
    flexDirection: 'row',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  tagContainer: {
    flex: 1,
    padding: 16,
  },
  tagList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  tagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    margin: 4,
  },
  tagText: {
    fontSize: 14,
    marginRight: 4,
  },
  removeButton: {
    padding: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  input: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  suggestionsContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 120,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    maxHeight: 200,
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  suggestionText: {
    fontSize: 14,
  },
  saveButton: {
    margin: 16,
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 