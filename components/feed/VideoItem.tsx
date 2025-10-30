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
    setLoading(false);
    onReady && onReady(meta);
  }, [onReady]);

  const handleBuffer = useCallback(({ isBuffering }) => {
    setLoading(isBuffering);
    onBuffer && onBuffer(isBuffering);
  }, [onBuffer]);

  const handleError = useCallback((err) => {
    setLoading(false);
    onError && onError(err);
  }, [onError]);

  // mute toggle
  const toggleMute = useCallback(() => setMuted(m => !m), []);

  // video style: fill availableHeight (so it won't be cut by tab bar)
  const videoStyle = useMemo(() => ({
    width: SCREEN_WIDTH,
    height: availableHeight,
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
      />

      {loading && (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}

      <View style={styles.topLeft}>
        <Text style={styles.indexText}>{id ?? ''}</Text>
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
