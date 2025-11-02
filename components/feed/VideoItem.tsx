// src/VideoItem.js
import Ionicons from '@expo/vector-icons/Ionicons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Video from 'react-native-video';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const DEFAULT_LONG_VISIBLE_MS = 5000;

function VideoItemComponent({
  id,
  uri,
  isActive = false,
  overlay = null,
  onReady = () => {},
  onBuffer = () => {},
  onError = () => {},
  onLongVisible = () => {},
  longVisibleMs = DEFAULT_LONG_VISIBLE_MS,
  style = {},
}) {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight?.() ?? 0;
  const containerRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [measuredHeight, setMeasuredHeight] = useState(null);
  const longVisibleTimer = useRef(null);
  
  // Video controls state
  const [manuallyPaused, setManuallyPaused] = useState(false);
  const [showPauseIcon, setShowPauseIcon] = useState(false);
  const pauseIconTimeout = useRef(null);
  
  // Seek bar state
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // IMPORTANT: assume tabBarHeight already accounts for bottom inset (react-navigation does).
  // We subtract only the tabBarHeight so video reaches the top and ends right above the tab bar.
  // This ensures the video container and all its children (including seek bar) are positioned above the tab bar.
  const availableHeight = useMemo(
    () => SCREEN_HEIGHT - tabBarHeight,
    [tabBarHeight]
  );

  // Start/clear the long-visible timer when isActive changes
  useEffect(() => {
    if (isActive) {
      longVisibleTimer.current = setTimeout(() => {
        onLongVisible && onLongVisible({ id, uri });
      }, longVisibleMs);
    } else {
      if (longVisibleTimer.current) {
        clearTimeout(longVisibleTimer.current);
        longVisibleTimer.current = null;
      }
    }
    return () => {
      if (longVisibleTimer.current) {
        clearTimeout(longVisibleTimer.current);
        longVisibleTimer.current = null;
      }
    };
  }, [isActive, id, uri, longVisibleMs, onLongVisible]);


  const handleBuffer = useCallback(({ isBuffering }) => {
    setLoading(isBuffering);
    onBuffer && onBuffer(isBuffering);
  }, [onBuffer]);

  const handleError = useCallback((err) => {
    console.error('[VideoItem] Video error:', id, uri, err);
    setLoading(false);
    setError(err);
    onError && onError(err);
  }, [onError, id, uri]);

  const handleRetry = useCallback(() => {
    console.log('[VideoItem] Retrying video:', id, uri);
    setError(null);
    setLoading(true);
    setRetryCount(prev => prev + 1);
  }, [id, uri]);

  // mute toggle
  const toggleMute = useCallback(() => setMuted(m => !m), []);

  // Play/Pause toggle on tap
  const handleVideoTap = useCallback(() => {
    setManuallyPaused(prev => {
      const newState = !prev;
      if (newState) {
        // Show pause icon with fade in
        setShowPauseIcon(true);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
        
        // Auto-hide after 2 seconds
        if (pauseIconTimeout.current) {
          clearTimeout(pauseIconTimeout.current);
        }
        pauseIconTimeout.current = setTimeout(() => {
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }).start(() => {
            setShowPauseIcon(false);
          });
        }, 2000);
      } else {
        // Hide pause icon immediately when playing
        if (pauseIconTimeout.current) {
          clearTimeout(pauseIconTimeout.current);
        }
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          setShowPauseIcon(false);
        });
      }
      return newState;
    });
  }, [fadeAnim]);

  // Reset manual pause when video becomes inactive
  useEffect(() => {
    if (!isActive) {
      setManuallyPaused(false);
      setShowPauseIcon(false);
      if (pauseIconTimeout.current) {
        clearTimeout(pauseIconTimeout.current);
      }
    }
  }, [isActive]);

  // Cleanup pause icon timeout
  useEffect(() => {
    return () => {
      if (pauseIconTimeout.current) {
        clearTimeout(pauseIconTimeout.current);
      }
    };
  }, []);

  // Video progress tracking for seek bar
  const handleProgress = useCallback((data: { currentTime: number; seekableDuration: number }) => {
    setCurrentTime(data.currentTime);
    if (data.seekableDuration > 0) {
      setDuration(data.seekableDuration);
    }
  }, []);

  const handleLoad = useCallback((meta) => {
    console.log('[VideoItem] Video loaded:', id, uri);
    setLoading(false);
    setError(null);
    setRetryCount(0);
    if (meta?.duration) {
      setDuration(meta.duration);
    }
    onReady && onReady(meta);
  }, [onReady, id, uri]);

  // Calculate seek bar progress
  const progress = duration > 0 ? currentTime / duration : 0;
  const progressWidth = progress * SCREEN_WIDTH;

  // video style: fill availableHeight (so it won't be cut by tab bar)
  const videoStyle = useMemo(() => ({
    width: SCREEN_WIDTH,
    height: availableHeight,
    backgroundColor: 'black',
    position: 'absolute',
    top: 0,
    left: 0,
  }), [availableHeight]);

  const onContainerLayout = useCallback((e) => {
    const h = e.nativeEvent.layout.height;
    setMeasuredHeight(h);
  }, []);

  return (
    <Pressable
      ref={containerRef}
      onLayout={onContainerLayout}
      onPress={handleVideoTap}
      style={[styles.container, { height: availableHeight }, style]}
    >
      <Video
        ref={videoRef}
        key={`${uri}-${retryCount}`}
        source={{ uri }}
        style={videoStyle}
        resizeMode="cover"
        paused={!isActive || manuallyPaused}
        repeat
        muted={muted}
        onLoad={handleLoad}
        onProgress={handleProgress}
        onBuffer={handleBuffer}
        onError={handleError}
        playWhenInactive={false}
        playInBackground={false}
        ignoreSilentSwitch="ignore"
        controls={false}
        poster=""
        posterResizeMode="cover"
        progressUpdateInterval={250}
      />

      {loading && (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}

      {error && !loading && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#ff6b6b" />
          <Text style={styles.errorTitle}>Video Failed to Load</Text>
          <Text style={styles.errorMessage}>
            {error.error?.code === 'ENOTFOUND' 
              ? 'No internet connection'
              : error.error?.localizedFailureReason || error.error?.localizedDescription || 'Unable to play this video'
            }
          </Text>
          {retryCount < 3 && (
            <TouchableOpacity 
              style={styles.retryButton} 
              onPress={handleRetry}
            >
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          )}
          {retryCount >= 3 && (
            <Text style={styles.errorMessage}>
              Failed after 3 attempts. Swipe to next video.
            </Text>
          )}
        </View>
      )}

      <View style={styles.topLeft}>
        <Text style={styles.indexText}>Video {id ?? ''}</Text>
        <Text style={[styles.indexText, { fontSize: 10 }]}>
          {isActive ? '▶ ACTIVE' : '⏸ PAUSED'}
        </Text>
        <Text style={[styles.indexText, { fontSize: 10 }]}>
          {loading ? '⏳ LOADING' : '✅ LOADED'}
        </Text>
      </View>

      <View style={styles.bottomRight}>
        <TouchableOpacity 
          onPress={(e) => {
            e.stopPropagation();
            toggleMute();
          }} 
          style={styles.iconBtn} 
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={28} color="#fff" />
        </TouchableOpacity>
        <View style={{ width: 8 }} />
      </View>

      {/* Pause Icon Overlay */}
      {manuallyPaused && showPauseIcon && (
        <Animated.View 
          style={[
            styles.pauseOverlay,
            {
              opacity: fadeAnim,
            }
          ]}
          pointerEvents="none"
        >
          <Ionicons name="pause" size={80} color="#fff" />
        </Animated.View>
      )}

      {/* Seek Bar */}
      {duration > 0 && isActive && (
        <Pressable 
          style={styles.seekBarContainer}
          onPress={(e) => {
            e.stopPropagation(); // Prevent triggering video tap
            const x = e.nativeEvent.locationX;
            const progress = Math.max(0, Math.min(1, x / SCREEN_WIDTH));
            const newTime = progress * duration;
            
            if (videoRef.current && duration > 0) {
              videoRef.current.seek(newTime);
              setCurrentTime(newTime);
            }
          }}
        >
          <View style={styles.seekBarBackground} />
          <View style={[styles.seekBarProgress, { width: progressWidth }]} />
        </Pressable>
      )}

      {overlay ? <View style={styles.overlay}>{overlay}</View> : null}
    </Pressable>
  );
}

export default React.memo(VideoItemComponent);

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    backgroundColor: 'black',
  },
  loading: {
    position: 'absolute',
    top: SCREEN_HEIGHT / 2 - 24,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  errorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    padding: 20,
  },
  errorTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  errorMessage: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 20,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
    gap: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  overlay: {
    position: 'absolute',
    bottom: 120,
    left: 16,
    right: 16,
  },
  topLeft: {
    position: 'absolute',
    top: Platform.select({ ios: 40, android: 16 }),
    left: 16,
  },
  indexText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  bottomRight: {
    position: 'absolute',
    right: 12,
    bottom: Platform.select({ ios: 100, android: 80 }),
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    padding: 6,
    backgroundColor: '#0006',
    borderRadius: 24,
  },
  pauseOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  seekBarContainer: {
    position: 'absolute',
    // bottom: 0 positions seek bar at the bottom edge of the container
    // Since container height = SCREEN_HEIGHT - tabBarHeight, this ensures
    // seek bar is positioned right above the tab bar
    bottom: 0,
    left: 0,
    right: 0,
    height: 30, // Touch area height (visual bar is 1px at bottom)
    justifyContent: 'center',
    zIndex: 10,
  },
  seekBarBackground: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  seekBarProgress: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 1,
    backgroundColor: '#fff',
  },
});
