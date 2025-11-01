// src/Feed.js
import VideoItem from '@/components/feed/VideoItem';
import HlsPrefetcherModule from '@/modules/hls-prefetcher';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, FlatList } from 'react-native';


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
const INITIAL_SEGMENT_COUNT = 5;
// Number of videos to prefetch ahead/behind current video
const PREFETCH_WINDOW = 1;

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
    } catch (error) {
      console.warn(`[Prefetch] Error prefetching remaining segments for video ${videoIndex}:`, error);
    }
  }, []);

  // Prefetch initial videos on mount
  useEffect(() => {
    prefetchAdjacentVideos(currentIndex);
  }, []);

  // Prefetch adjacent videos when current index changes
  useEffect(() => {
    prefetchAdjacentVideos(currentIndex);
  }, [currentIndex, prefetchAdjacentVideos]);

  const renderItem = useCallback(({ item, index }) => (
    <VideoItem
      id={index}
      uri={item}
      isActive={index === currentIndex}
      style={{ height: ITEM_HEIGHT }}
      onLongVisible={({ uri }) => {
        // Prefetch remaining segments when user watches for 5+ seconds
        prefetchRemainingSegments(uri, index);
      }}
    />
  ), [currentIndex, ITEM_HEIGHT, prefetchRemainingSegments]);

  const getItemLayout = useCallback((_, index) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  }), [ITEM_HEIGHT]);

  const onMomentumScrollEnd = useCallback((evt) => {
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










// import VideoItem from '@/components/feed/VideoItem';
// import React from 'react';
// import { Dimensions, FlatList, StyleSheet } from 'react-native';

// const { width } = Dimensions.get('window');

// const Feed = () => {
//  const videos = [
//     'https://www.w3schools.com/html/mov_bbb.mp4',
//     'https://assets.hify.club/full-replays/2447/36/playlist.m3u8'
//   ];

//   // return (
//   //   <View style={styles.container}>
//   //     <Video
//   //       source={{ uri: 'https://www.w3schools.com/html/mov_bbb.mp4' }}
//   //       style={styles.video}
//   //       resizeMode="cover"
//   //       controls={true}
//   //       repeat
//   //       paused={false}
//   //     />
//   //   </View>
//   // );

//     return (
//     <FlatList
//       data={videos}
//       renderItem={({ item, index }) => (
//         <VideoItem id={`id+${index}`} uri={item} isActive={index === 0} />
//       )}
//       keyExtractor={(item, i) => i.toString()}
//     />
//   );
// };

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: 'black',
//   },
//   video: {
//     width,
//     height: '100%',
//   },
// });

// export default Feed;
