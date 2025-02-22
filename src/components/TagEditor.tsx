import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StorageService } from '../services/storage';
import { TagService } from '../services/tagService';
import { Meme } from '../types/meme';
import { useTheme } from '../contexts/ThemeContext';

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
  const { isDarkMode } = useTheme();
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
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: isDarkMode ? '#000' : '#fff' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <View style={[styles.header, { 
        borderBottomColor: isDarkMode ? '#333' : '#f0f0f0',
        backgroundColor: isDarkMode ? '#1c1c1c' : '#fff',
      }]}>
        <Text style={[styles.title, { color: isDarkMode ? '#fff' : '#000' }]}>编辑标签</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleGenerateTags}
          >
            <Ionicons name="refresh" size={24} color={isDarkMode ? '#fff' : '#007AFF'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={onClose}
          >
            <Ionicons name="close" size={24} color={isDarkMode ? '#fff' : '#000'} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.tagContainer}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.tagList}>
          {tags.map((tag, index) => (
            <View key={index} style={[
              styles.tagItem,
              { backgroundColor: isDarkMode ? '#333' : '#f0f0f0' }
            ]}>
              <Text style={[styles.tagText, { color: isDarkMode ? '#fff' : '#000' }]}>{tag}</Text>
              <TouchableOpacity
                onPress={() => handleRemoveTag(tag)}
                style={styles.removeButton}
              >
                <Ionicons name="close-circle" size={20} color={isDarkMode ? '#fff' : '#666'} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.bottomContainer, { 
        borderTopColor: isDarkMode ? '#333' : '#f0f0f0',
        backgroundColor: isDarkMode ? '#1c1c1c' : '#fff',
      }]}>
        {suggestions.length > 0 && (
          <View style={[
            styles.suggestionsContainer,
            {
              backgroundColor: isDarkMode ? '#1c1c1c' : '#fff',
              borderColor: isDarkMode ? '#333' : '#ddd',
            }
          ]}>
            {suggestions.map((suggestion, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.suggestionItem,
                  { borderBottomColor: isDarkMode ? '#333' : '#f0f0f0' },
                  index === suggestions.length - 1 && { borderBottomWidth: 0 }
                ]}
                onPress={() => handleSuggestionPress(suggestion)}
              >
                <Text style={[
                  styles.suggestionText,
                  { color: isDarkMode ? '#fff' : '#000' }
                ]}>{suggestion}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.inputContainer}>
          <TextInput
            style={[
              styles.input,
              {
                borderColor: isDarkMode ? '#333' : '#ddd',
                backgroundColor: isDarkMode ? '#333' : '#fff',
                color: isDarkMode ? '#fff' : '#000',
              }
            ]}
            value={newTag}
            onChangeText={handleInputChange}
            placeholder="添加新标签"
            placeholderTextColor={isDarkMode ? '#666' : '#999'}
            maxLength={20}
            returnKeyType="done"
            onSubmitEditing={handleAddTag}
          />
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAddTag}
          >
            <Text style={styles.addButtonText}>添加</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, Platform.OS === 'ios' && styles.saveButtonIOS]}
          onPress={handleSave}
        >
          <Text style={styles.saveButtonText}>保存</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
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
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  tagList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
  bottomContainer: {
    borderTopWidth: 1,
    paddingTop: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
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
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    maxHeight: 120,
    marginHorizontal: 16,
    marginBottom: 8,
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
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonIOS: {
    marginBottom: 16,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 