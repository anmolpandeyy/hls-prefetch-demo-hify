import VideoItem from '@/components/feed/VideoItem';
import HlsPrefetcherModule from '@/modules/hls-prefetcher';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, FlatList, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

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

// Number of initial segments to prefetch for instant playback
const INITIAL_SEGMENT_COUNT = 2;
// Number of videos to prefetch ahead/behind current video
const PREFETCH_WINDOW = 2;

export default function Feed() {
  const tabBarHeight = useBottomTabBarHeight?.() ?? 0;
  const ITEM_HEIGHT = SCREEN_HEIGHT - tabBarHeight;
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatRef = useRef(null);
  
  // Track which videos have been prefetched to avoid duplicates
  const prefetchedVideos = useRef(new Set<string>());
  const longViewedVideos = useRef(new Set<string>());

  // Prefetch videos adjacent to current index
  const prefetchAdjacentVideos = useCallback(async (centerIndex: number) => {
    const indicesToPrefetch: number[] = [];
    
    // Prefetch videos within the window (previous and next)
    for (let i = -PREFETCH_WINDOW; i <= PREFETCH_WINDOW; i++) {
      const index = centerIndex + i;
      if (index >= 0 && index < PLAYLISTS.length) {
        indicesToPrefetch.push(index);
      }
    }

    // Prefetch each video
    for (const index of indicesToPrefetch) {
      const videoUrl = PLAYLISTS[index];
      
      // Skip if already prefetched
      if (prefetchedVideos.current.has(videoUrl)) {
        continue;
      }

      try {
        console.log(`[Prefetch] Starting prefetch for video ${index}: ${videoUrl}`);
        
        const result = await HlsPrefetcherModule.prefetchPlaylist(
          videoUrl,
          INITIAL_SEGMENT_COUNT
        );
        
        prefetchedVideos.current.add(videoUrl);
        
        console.log(`[Prefetch] Completed video ${index}: ${result.prefetchedSegments}/${result.totalSegments} segments`);
      } catch (error) {
        console.warn(`[Prefetch] Error prefetching video ${index}:`, error);
      }
    }
  }, []);

  // Prefetch remaining segments when user watches video for 5+ seconds
  const prefetchRemainingSegments = useCallback(async (uri: string, videoIndex: number) => {
    // Skip if already prefetched all segments
    if (longViewedVideos.current.has(uri)) {
      return;
    }

    try {
      console.log(`[Prefetch] User watching video ${videoIndex}, prefetching remaining segments...`);
      
      // Prefetch a larger number of segments (or all by using a high number)
      const result = await HlsPrefetcherModule.prefetchPlaylist(uri, 50);
      
      longViewedVideos.current.add(uri);
      
      console.log(`[Prefetch] Completed remaining segments for video ${videoIndex}: ${result.prefetchedSegments}/${result.totalSegments}`);
      
      // Log cache stats after successful prefetch
      const cacheStats = await HlsPrefetcherModule.getCacheStats();
      
      // Format cache stats in MB for readability
      const formatMB = (bytes: number | undefined) => bytes ? (bytes / (1024 * 1024)).toFixed(2) : '0.00';
      
      if ('currentDiskUsage' in cacheStats) {
        // iOS format
        const iosStats = cacheStats as { currentDiskUsage: number; diskCapacity: number; currentMemoryUsage: number; memoryCapacity: number };
        console.log(`[Cache Stats] After prefetching video ${videoIndex}:`);
        console.log(`  💾 Disk: ${formatMB(iosStats.currentDiskUsage)}MB / ${formatMB(iosStats.diskCapacity)}MB`);
        console.log(`  🧠 Memory: ${formatMB(iosStats.currentMemoryUsage)}MB / ${formatMB(iosStats.memoryCapacity)}MB`);
      } else if ('size' in cacheStats) {
        // Android format
        const androidStats = cacheStats as { size: number; maxSize: number; requestCount: number; hitCount: number; networkCount: number };
        const hitRate = androidStats.requestCount > 0 
          ? ((androidStats.hitCount / androidStats.requestCount) * 100).toFixed(1)
          : '0.0';
        console.log(`[Cache Stats] After prefetching video ${videoIndex}:`);
        console.log(`  💾 Cache: ${formatMB(androidStats.size)}MB / ${formatMB(androidStats.maxSize)}MB`);
        console.log(`  📊 Requests: ${androidStats.requestCount} (${androidStats.hitCount} hits, ${androidStats.networkCount} network)`);
        console.log(`  ✅ Hit Rate: ${hitRate}%`);
      }
    } catch (error) {
      console.warn(`[Prefetch] Error prefetching remaining segments for video ${videoIndex}:`, error);
    }
  }, []);

  // Prefetch initial videos on mount
  useEffect(() => {
    prefetchAdjacentVideos(currentIndex);
  }, [prefetchAdjacentVideos, currentIndex]);

  // Prefetch adjacent videos when current index changes
  useEffect(() => {
    prefetchAdjacentVideos(currentIndex);
  }, [currentIndex, prefetchAdjacentVideos]);

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
