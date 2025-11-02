import VideoItem from '@/components/feed/VideoItem';
import { useVideoPrefetch } from '@/hooks/useVideoPrefetch';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import React, { useCallback, useRef, useState } from 'react';
import { Dimensions, FlatList, NativeScrollEvent, NativeSyntheticEvent, Platform } from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const PLAYLISTS = [
  'https://assets.hify.club/full-replays/2447/36/playlist.m3u8',
  'https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_4x3/gear1/prog_index.m3u8',
  'https://assets.hify.club/full-replays/2562/33/playlist.m3u8',
  'https://assets.hify.club/full-replays/2635/59/playlist.m3u8',
  'https://assets.hify.club/full-replays/2777/39/playlist.m3u8',
  'https://assets.hify.club/full-replays/2506/39/playlist.m3u8',
  'https://assets.hify.club/full-replays/2729/39/playlist.m3u8',
  'https://assets.hify.club/full-replays/2732/49/playlist.m3u8',
  'https://assets.hify.club/full-replays/2638/49/playlist.m3u8',
];

// Prefetch configuration
const INITIAL_SEGMENT_COUNT = 2;  // Initial segments per video
const PREFETCH_WINDOW = 2;         // Videos ahead/behind to prefetch (±2)
const EXTENDED_SEGMENT_COUNT = 50; // Segments for long-viewed videos

export default function Feed() {
  const tabBarHeight = useBottomTabBarHeight?.() ?? 0;
  
  // On Android: tab bar is an overlay (doesn't affect layout), use full screen height
  // On iOS: tab bar is part of layout (takes space), subtract it
  const ITEM_HEIGHT = Platform.OS === 'android' 
    ? SCREEN_HEIGHT 
    : SCREEN_HEIGHT - tabBarHeight;
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatRef = useRef(null);
  
  // Use custom hook for video prefetching logic
  const { prefetchRemainingSegments } = useVideoPrefetch({
    playlists: PLAYLISTS,
    currentIndex,
    initialSegmentCount: INITIAL_SEGMENT_COUNT,
    prefetchWindow: PREFETCH_WINDOW,
    extendedSegmentCount: EXTENDED_SEGMENT_COUNT,
  });

  const renderItem = useCallback(({ item, index }: { item: string; index: number }) => (
    <VideoItem
      id={index}
      uri={item}
      isActive={index === currentIndex}
      style={{ height: ITEM_HEIGHT }}
      onLongVisible={((data: { id: number; uri: string }) => {
        // Prefetch remaining segments when user watches for 5+ seconds
        prefetchRemainingSegments(data.uri, index);
      }) as () => void}
    />
  ), [currentIndex, ITEM_HEIGHT, prefetchRemainingSegments]);

  const getItemLayout = useCallback((_data: unknown, index: number) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  }), [ITEM_HEIGHT]);

  const onMomentumScrollEnd = useCallback((evt: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = evt.nativeEvent.contentOffset.y;
    const newIndex = Math.round(offsetY / ITEM_HEIGHT);
    setCurrentIndex(newIndex);
  }, [ITEM_HEIGHT]);

  return (
    <FlatList
      ref={flatRef}
      data={PLAYLISTS}
      renderItem={renderItem}
      keyExtractor={(item, i) => `${i}-${item}`}
      snapToInterval={ITEM_HEIGHT}
      snapToAlignment="start"
      decelerationRate="fast"
      disableIntervalMomentum
      getItemLayout={getItemLayout}
      initialNumToRender={2}
      maxToRenderPerBatch={2}
      windowSize={3}
      showsVerticalScrollIndicator={false}
      onMomentumScrollEnd={onMomentumScrollEnd}
    />
  );
}
