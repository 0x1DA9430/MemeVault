import React, { useRef, useState, useEffect } from 'react';
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
  Animated,
  Alert,
  Text,
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
  memes: Meme[];
}

const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;
const SWIPE_THRESHOLD = 100;
const SHARE_THRESHOLD = -100;
const HORIZONTAL_SWIPE_THRESHOLD = screenWidth * 0.2;

export const MemePreview: React.FC<MemePreviewProps> = ({
  meme,
  visible,
  onClose,
  memes,
}) => {
  const viewShotRef = useRef<ViewShot>(null);
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [imageSize, setImageSize] = useState({ width: screenWidth, height: screenWidth });
  const [isSharing, setIsSharing] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);

  useEffect(() => {
    if (meme) {
      const index = memes.findIndex(m => m.id === meme.id);
      setCurrentIndex(index);
      Image.getSize(meme.uri, (width, height) => {
        const aspectRatio = height / width;
        setImageSize({
          width: screenWidth,
          height: screenWidth * aspectRatio,
        });
      });
    }
  }, [meme, memes]);

  useEffect(() => {
    if (visible) {
      resetAnimatedValues();
      setIsSharing(false);
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          damping: 25,
          mass: 0.8,
          stiffness: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const switchToImage = (index: number) => {
    if (index < 0 || index >= memes.length) return false;
    
    const nextMeme = memes[index];
    Image.getSize(nextMeme.uri, (width, height) => {
      const aspectRatio = height / width;
      setImageSize({
        width: screenWidth,
        height: screenWidth * aspectRatio,
      });
    });
    setCurrentIndex(index);
    return true;
  };

  const handleHorizontalSwipe = (direction: 'left' | 'right') => {
    const nextIndex = direction === 'left' ? currentIndex + 1 : currentIndex - 1;
    if (nextIndex < 0 || nextIndex >= memes.length) {
      // 如果超出范围，回弹
      Animated.spring(translateX, {
        toValue: 0,
        damping: 20,
        mass: 0.6,
        stiffness: 400,
        useNativeDriver: true,
      }).start();
      return;
    }

    // 切换到下一张图片
    const targetX = direction === 'left' ? -screenWidth : screenWidth;
    Animated.sequence([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: targetX,
        duration: 0,
        useNativeDriver: true,
      }),
    ]).start(() => {
      switchToImage(nextIndex);
      translateX.setValue(-targetX);
      Animated.parallel([
        Animated.spring(translateX, {
          toValue: 0,
          damping: 20,
          mass: 0.6,
          stiffness: 400,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const resetAnimatedValues = () => {
    translateY.setValue(0);
    translateX.setValue(0);
    scale.setValue(0.8);
    opacity.setValue(0);
    setIsClosing(false);
  };

  const handleShare = async () => {
    if (!meme || !viewShotRef.current || isSharing) return;
    setIsSharing(true);

    try {
      const uri = await captureRef(viewShotRef, {
        format: 'jpg',
        quality: 1,
      });
      
      if (!uri) return;

      if (Platform.OS === 'ios') {
        await Share.share({
          url: uri,
        });
      } else {
        await Sharing.shareAsync(uri, {
          UTI: 'public.image',
          mimeType: 'image/jpeg',
          dialogTitle: '分享到微信',
        });
      }
    } catch (error) {
      console.error('分享失败:', error);
    } finally {
      setIsSharing(false);
    }
  };

  const handleClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: screenHeight,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.3,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
      setIsClosing(false);
    });
  };

  const gesture = Gesture.Pan()
    .onChange((event) => {
      if (isClosing) return;

      if (Math.abs(event.translationX) > Math.abs(event.translationY)) {
        // 水平滑动
        translateX.setValue(event.translationX);
      } else {
        // 垂直滑动
        if (event.translationY < 0) {
          translateY.setValue(event.translationY);
          scale.setValue(Math.max(0.95, 1 + event.translationY / screenHeight));
        } else if (event.translationY > 0) {
          translateY.setValue(event.translationY);
          const newScale = Math.max(0.3, 1 - event.translationY / screenHeight);
          scale.setValue(newScale);
          opacity.setValue(Math.max(0, 1 - event.translationY / (screenHeight * 0.5)));
        }
      }
    })
    .onEnd((event) => {
      if (isClosing) return;

      if (Math.abs(event.translationX) > Math.abs(event.translationY)) {
        // 处理水平滑动
        if (Math.abs(event.translationX) > HORIZONTAL_SWIPE_THRESHOLD) {
          handleHorizontalSwipe(event.translationX > 0 ? 'right' : 'left');
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            damping: 20,
            mass: 0.6,
            stiffness: 400,
            useNativeDriver: true,
          }).start();
        }
      } else {
        // 处理垂直滑动
        if (event.translationY < SHARE_THRESHOLD && event.velocityY < 0) {
          handleShare();
          Animated.parallel([
            Animated.spring(translateY, {
              toValue: 0,
              damping: 15,
              mass: 1,
              stiffness: 150,
              useNativeDriver: true,
            }),
            Animated.spring(scale, {
              toValue: 1,
              damping: 15,
              mass: 1,
              stiffness: 150,
              useNativeDriver: true,
            }),
          ]).start();
        } else if (event.velocityY > 0 && event.translationY > SWIPE_THRESHOLD) {
          handleClose();
        } else {
          Animated.parallel([
            Animated.spring(translateY, {
              toValue: 0,
              damping: 15,
              mass: 1,
              stiffness: 150,
              useNativeDriver: true,
            }),
            Animated.spring(scale, {
              toValue: 1,
              damping: 15,
              mass: 1,
              stiffness: 150,
              useNativeDriver: true,
            }),
            Animated.spring(opacity, {
              toValue: 1,
              damping: 15,
              mass: 1,
              stiffness: 150,
              useNativeDriver: true,
            }),
          ]).start();
        }
      }
    });

  if (!meme) return null;

  const animatedContainerStyle = {
    transform: [
      { translateX },
      { translateY },
      { scale },
    ],
    opacity,
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={handleClose}
    >
      <GestureHandlerRootView style={styles.gestureRoot}>
        <GestureDetector gesture={gesture}>
          <View style={styles.container}>
            <TouchableWithoutFeedback onPress={handleClose}>
              <View style={styles.container}>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={handleClose}
                >
                  <Ionicons name="close" size={28} color="#fff" />
                </TouchableOpacity>

                <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
                  <Animated.View style={[styles.imageWrapper, animatedContainerStyle, { width: imageSize.width, height: imageSize.height }]}>
                    <ViewShot
                      ref={viewShotRef}
                      options={{
                        format: 'jpg',
                        quality: 1,
                      }}
                      style={styles.imageContainer}
                    >
                      <Image
                        source={{ uri: memes[currentIndex]?.uri }}
                        style={styles.image}
                        resizeMode="contain"
                      />
                    </ViewShot>
                  </Animated.View>
                </TouchableWithoutFeedback>

                <TouchableOpacity
                  style={styles.shareButton}
                  onPress={handleShare}
                  disabled={isSharing}
                >
                  <Ionicons name="share-outline" size={32} color="#fff" />
                </TouchableOpacity>

                <Animated.View style={[styles.shareHint, {
                  opacity: Animated.multiply(opacity, translateY.interpolate({
                    inputRange: [-100, 0],
                    outputRange: [1, 0],
                    extrapolate: 'clamp',
                  })),
                }]}>
                  <Text style={styles.shareHintText}>上滑分享</Text>
                </Animated.View>
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {
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
  shareHint: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  shareHintText: {
    color: '#fff',
    fontSize: 14,
  },
}); 