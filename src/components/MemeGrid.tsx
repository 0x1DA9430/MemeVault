import React, { useRef } from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  FlatList,
  Text,
} from 'react-native';
import { Meme } from '../types/meme';

interface MemeGridProps {
  memes: Meme[];
  onMemePress: (meme: Meme, position: { x: number; y: number; width: number; height: number }) => void;
  onMemeLongPress?: (meme: Meme) => void;
}

const numColumns = 3;
const screenWidth = Dimensions.get('window').width;
const gap = 2;
const itemWidth = (screenWidth - (numColumns + 1) * gap) / numColumns;

export const MemeGrid: React.FC<MemeGridProps> = ({
  memes,
  onMemePress,
  onMemeLongPress,
}) => {
  const itemRefs = useRef<{ [key: string]: View | null }>({});

  const handlePress = (meme: Meme) => {
    const item = itemRefs.current[meme.id];
    if (item) {
      item.measureInWindow((x, y, width, height) => {
        onMemePress(meme, { x, y, width, height });
      });
    }
  };

  const renderItem = ({ item }: { item: Meme }) => (
    <TouchableOpacity
      style={styles.memeContainer}
      onPress={() => handlePress(item)}
      onLongPress={() => onMemeLongPress?.(item)}
    >
      <View
        ref={ref => itemRefs.current[item.id] = ref}
        style={styles.memeContainer}
      >
        <Image source={{ uri: item.uri }} style={styles.memeImage} />
        {item.favorite && (
          <View style={styles.favoriteIndicator}>
            <Text style={styles.favoriteIcon}>★</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <FlatList
      data={memes}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      numColumns={numColumns}
      contentContainerStyle={styles.container}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    padding: gap,
  },
  memeContainer: {
    width: itemWidth,
    height: itemWidth,
    margin: gap / 2,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  memeImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  favoriteIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoriteIcon: {
    color: '#FFD700',
    fontSize: 16,
  },
}); 