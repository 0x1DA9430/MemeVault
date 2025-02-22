import React, { useRef } from 'react';
import {
  View,
  Modal,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Share,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import ViewShot, { captureRef } from 'react-native-view-shot';
import {
  GestureHandlerRootView,
  GestureDetector,
  Gesture,
} from 'react-native-gesture-handler';
import { Meme } from '../types/meme';

interface MemePreviewProps {
  meme: Meme | null;
  visible: boolean;
  onClose: () => void;
}

const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;
const SWIPE_THRESHOLD = 100; // 下滑多少距离触发关闭

export const MemePreview: React.FC<MemePreviewProps> = ({
  meme,
  visible,
  onClose,
}) => {
  const viewShotRef = useRef<ViewShot>(null);

  const gesture = Gesture.Pan()
    .onEnd((event) => {
      if (event.velocityY > 0 && event.translationY > SWIPE_THRESHOLD) {
        onClose();
      }
    });

  const handleShare = async () => {
    if (!meme || !viewShotRef.current) return;

    try {
      // 捕获图片
      const uri = await captureRef(viewShotRef, {
        format: 'jpg',
        quality: 1,
      });
      
      if (!uri) return;

      if (Platform.OS === 'ios') {
        // iOS 使用系统分享
        await Share.share({
          url: uri,
        });
      } else {
        // Android 使用 expo-sharing
        await Sharing.shareAsync(uri, {
          UTI: 'public.image',
          mimeType: 'image/jpeg',
        });
      }
    } catch (error) {
      console.error('分享失败:', error);
    }
  };

  if (!meme) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.gestureRoot}>
        <GestureDetector gesture={gesture}>
          <View style={styles.container}>
            <TouchableWithoutFeedback onPress={onClose}>
              <View style={styles.container}>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={onClose}
                >
                  <Ionicons name="close" size={28} color="#fff" />
                </TouchableOpacity>

                <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
                  <View style={styles.imageWrapper}>
                    <ViewShot
                      ref={viewShotRef}
                      options={{
                        format: 'jpg',
                        quality: 1,
                      }}
                      style={styles.imageContainer}
                    >
                      <Image
                        source={{ uri: meme.uri }}
                        style={styles.image}
                        resizeMode="contain"
                      />
                    </ViewShot>
                  </View>
                </TouchableWithoutFeedback>

                <TouchableOpacity
                  style={styles.shareButton}
                  onPress={handleShare}
                >
                  <Ionicons name="share-outline" size={32} color="#fff" />
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {
    width: screenWidth,
    height: screenHeight * 0.7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  shareButton: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
}); 