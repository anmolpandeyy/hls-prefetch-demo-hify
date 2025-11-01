// src/VideoItem.js
import Ionicons from '@expo/vector-icons/Ionicons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Platform,
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

  // IMPORTANT: assume tabBarHeight already accounts for bottom inset (react-navigation does).
  // We subtract only the tabBarHeight so video reaches the top and ends right above the tab bar.
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

  // handlers for Video
  const handleLoad = useCallback((meta) => {
    console.log('[VideoItem] Video loaded:', id, uri);
    setLoading(false);
    setError(null);
    setRetryCount(0);
    onReady && onReady(meta);
  }, [onReady, id, uri]);

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
    <View
      ref={containerRef}
      onLayout={onContainerLayout}
      style={[styles.container, { height: availableHeight }, style]}
    >
      <Video
        key={`${uri}-${retryCount}`}
        source={{ uri }}
        style={videoStyle}
        resizeMode="cover"
        paused={!isActive}
        repeat
        muted={muted}
        onLoad={handleLoad}
        onBuffer={handleBuffer}
        onError={handleError}
        playWhenInactive={false}
        playInBackground={false}
        ignoreSilentSwitch="ignore"
        controls={false}
        poster=""
        posterResizeMode="cover"
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
        <TouchableOpacity onPress={toggleMute} style={styles.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={28} color="#fff" />
        </TouchableOpacity>
        <View style={{ width: 8 }} />
      </View>

      {overlay ? <View style={styles.overlay}>{overlay}</View> : null}
    </View>
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
});
